"""admin_dashboard's metric-cache models share ContentTable with
academic/challenges -- re-export academic's accessor instead of
duplicating the boto3 boilerplate."""
from academic.dynamodb.client import get_table, now_iso, build_update_expression  # noqa: F401
