"""academic and challenges share one physical table (ContentTable) for
the first time in this codebase -- re-export academic's accessor instead
of duplicating the boto3 boilerplate. See
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md.
"""
from academic.dynamodb.client import get_table, now_iso, build_update_expression  # noqa: F401
