"""Pure key-building functions for the users DynamoDB schema. See
docs/superpowers/specs/2026-07-29-users-dynamodb-migration-design.md.
No AWS calls here - kept separate so the key format lives in one place.
"""


def user_pk(user_id):
    return f'USER#{user_id}'


def metadata_sk():
    return 'METADATA'


def username_gsi1pk(username):
    return f'USERNAME#{username.lower()}'


def email_gsi2pk(email):
    return f'EMAIL#{email.lower()}'


def access_code_pk(code):
    return f'ACCESSCODE#{code}'


def access_code_email_gsi2pk(email):
    return f'ACCESSCODEEMAIL#{email.lower()}'


def student_pk(student_id):
    return f'STUDENT#{student_id}'


def student_email_gsi2pk(email):
    return f'STUDENTEMAIL#{email.lower()}'
