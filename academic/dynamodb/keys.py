"""Pure key-formatting functions for the academic entities in
ContentTable. No AWS calls -- see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md
for the full key scheme."""


def faculty_pk(faculty_id):
    return f'FACULTY#{faculty_id}'


def career_pk(career_id):
    return f'CAREER#{career_id}'


def course_pk(course_id):
    return f'COURSE#{course_id}'


def metadata_sk():
    return 'METADATA'


def faculty_active_gsi1pk():
    return 'FACULTY#ACTIVE'


def career_faculty_gsi1pk(faculty_id):
    return f'FACULTY#{faculty_id}'


def course_career_gsi1pk(career_id):
    return f'CAREER#{career_id}'
