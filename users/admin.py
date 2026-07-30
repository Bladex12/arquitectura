"""
Admin para la app users.

Professor/Administrator/Student/ProfessorAccessCode moved to DynamoDB
(see users/models.py) and are no longer registerable Django ORM models
- there is nothing to register here. django.contrib.auth's own User
model keeps its default admin registration automatically; this file
intentionally has none of its own.
"""
