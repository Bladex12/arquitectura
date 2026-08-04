"""academic and challenges share ContentTable -- re-export academic's
moto test helpers instead of duplicating the schema definition."""
from academic.dynamodb.testing import create_test_table, DynamoDBTestCase  # noqa: F401
