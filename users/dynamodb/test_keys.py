from users.dynamodb import keys


def test_user_pk():
    assert keys.user_pk('abc-123') == 'USER#abc-123'


def test_metadata_sk():
    assert keys.metadata_sk() == 'METADATA'


def test_username_gsi1pk():
    assert keys.username_gsi1pk('jdoe') == 'USERNAME#jdoe'


def test_username_gsi1pk_lowercases():
    # Case-insensitive lookup key, matching MySQL's old default collation
    # (see final review Finding 2) - the stored `username` display field
    # itself is untouched, only this key-building function lowercases.
    assert keys.username_gsi1pk('Juan.Perez') == 'USERNAME#juan.perez'


def test_email_gsi2pk_lowercases():
    assert keys.email_gsi2pk('Jdoe@UDD.cl') == 'EMAIL#jdoe@udd.cl'


def test_access_code_pk():
    assert keys.access_code_pk('123456') == 'ACCESSCODE#123456'


def test_access_code_email_gsi2pk():
    assert keys.access_code_email_gsi2pk('a@udd.cl') == 'ACCESSCODEEMAIL#a@udd.cl'


def test_student_pk():
    assert keys.student_pk('s-1') == 'STUDENT#s-1'


def test_student_email_gsi2pk():
    assert keys.student_email_gsi2pk('S@UDD.cl') == 'STUDENTEMAIL#s@udd.cl'
