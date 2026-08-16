# AWS FIS chaos testing

Fault-injection experiments for the event-driven Lambdas (`WsConnectFunction`,
`WsDisconnectFunction`, `WsDefaultFunction`, `BroadcastFunction`,
`StreamToFirehoseFunction`). Lives in a **separate stack** from
`../template.yaml` on purpose — see the comment at the top of
`fis/template.yaml` for why.

`DjangoFunction` is not covered: it's a container-image Lambda
(`PackageType: Image`), and the AWS FIS Lambda extension can't be attached
as a plain Layer to those — see the same comment for detail.

## Unverified before you start: IAM on this account

`fis/template.yaml` creates a new IAM role (`FisExperimentRole`, trusted by
`fis.amazonaws.com`). Whether that's allowed on this AWS Academy Learner Lab
account is **unverified** — `DEPLOY.md` documents "no IAM role creation" as a
confirmed restriction for the main stack (that's why every Lambda there is
pinned to `LabRoleArn` instead of an auto-generated role), but it's untested
whether that extends to a role this narrowly scoped. Deploying this stack
*is* the test. If it fails at `FisExperimentRole` with an IAM `AccessDenied`,
that's your answer — FIS isn't usable here without a role provisioned some
other way (e.g. by course staff), and everything above that resource (the S3
bucket + bucket policy) can be left in place; only the role and the five
`ExperimentTemplate` resources need removing.

## Deploy order

Two stacks, one two-directional dependency (this stack needs the target
Lambdas' ARNs; the main stack needs this stack's bucket ARN to turn the
extension on) — so it's a 3-step dance:

**1. Get the 5 function ARNs from the already-deployed main stack** (the WS/
broadcast/firehose Lambdas already exist live — no main-stack redeploy
needed for this step):

```bash
aws cloudformation describe-stacks --stack-name mision-emprende \
  --region us-east-1 \
  --query "Stacks[0].Outputs[?contains(OutputKey, 'FunctionArn')]"
```

If those outputs aren't there yet (they were added alongside this FIS work),
redeploy the main stack first (`sam build && sam deploy`, same
`LabRoleArn`/`DjangoSecretKey` parameters as always — `FisConfigBucketArn`
defaults to `''` so this is a no-op for the FIS wiring, safe to run anytime,
including via the existing CI pipeline).

**2. Deploy this stack**, passing those 5 ARNs plus `LabRoleArn`:

```bash
cd fis
sam build
sam deploy --stack-name mision-emprende-fis --region us-east-1 \
  --capabilities CAPABILITY_IAM --resolve-s3 --no-confirm-changeset \
  --parameter-overrides \
    LabRoleArn="<same value as the main stack>" \
    WsConnectFunctionArn="<from step 1>" \
    WsDisconnectFunctionArn="<from step 1>" \
    WsDefaultFunctionArn="<from step 1>" \
    BroadcastFunctionArn="<from step 1>" \
    StreamToFirehoseFunctionArn="<from step 1>"
```

**3. Activate the extension on the main stack**, passing this stack's
`FisConfigBucketArn` output back in:

```bash
cd ..
FIS_BUCKET_ARN=$(aws cloudformation describe-stacks --stack-name mision-emprende-fis \
  --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='FisConfigBucketArn'].OutputValue" --output text)
sam deploy --parameter-overrides \
  LabRoleArn="<same as always>" \
  DjangoSecretKey="<same as always>" \
  FisConfigBucketArn="$FIS_BUCKET_ARN"
```

After this, the 5 target functions carry the FIS extension layer and will
pick up fault configs the next time an experiment runs (up to ~60s polling
delay the first time — see AWS's docs on the extension's slow-poll interval).

## Running an experiment

Nothing auto-starts. Each `ExperimentTemplate` is inert until you run it by
hand:

```bash
aws fis start-experiment --experiment-template-id <id-from-stack-output> --region us-east-1
aws fis get-experiment --id <experiment-id> --region us-east-1   # poll status
aws fis stop-experiment --id <experiment-id> --region us-east-1  # early abort
```

Template IDs are in this stack's outputs (`WsConnectExperimentId`,
`WsDisconnectExperimentId`, `WsDefaultExperimentId`, `BroadcastExperimentId`,
`StreamToFirehoseExperimentId`).

## What each experiment tests and why

| Experiment | Action | Params | What it's actually checking |
|---|---|---|---|
| `WsConnectInvocationErrorExperiment` | `invocation-error` | 50% / 2 min | Frontend's WS reconnect/backoff on a flaky `$connect` route |
| `WsDisconnectInvocationErrorExperiment` | `invocation-error` | 50% / 2 min | Orphaned `ConnectionsTable` rows when disconnect cleanup fails |
| `WsDefaultInvocationErrorExperiment` | `invocation-error` | 100% / 1 min | An unhandled-route failure doesn't kill the whole WS connection |
| `BroadcastInvocationErrorExperiment` | `invocation-error` | 100% / 5 min | **Highest priority.** No DLQ configured on this async-invoked function — does a dropped broadcast recover via the next poll, or does a screen go stale? |
| `StreamToFirehoseInvocationErrorExperiment` | `invocation-error` | 100% / 5 min | Confirms analytics failures never touch gameplay (safe to hit hard); also surfaces the missing DLQ/bisect-on-error config on this DynamoDB Streams consumer |

All use `preventExecution: true` — the function's real code never runs during
the injected window, so this is testing pure invoke-failure handling (retries,
timeouts, dropped events), not partial-execution edge cases.

## Unrelated finding surfaced while building this

`BroadcastFunction` runs on `python3.11`, which AWS deprecated 2026-06-30.
New-function creation on that runtime was disabled 2026-07-31, and **updates
are disabled 2026-08-31** — after that date, `sam deploy` can no longer touch
`BroadcastFunction` at all (including the Layer/env-var changes this FIS work
adds to it) until it's moved to a newer runtime (`python3.14`). Worth doing
before the end of August regardless of whether FIS ships.
