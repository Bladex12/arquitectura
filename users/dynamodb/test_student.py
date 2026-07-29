from users.dynamodb import student as student_repo
from users.dynamodb.testing import DynamoDBTestCase


class StudentTest(DynamoDBTestCase):
    def test_create_then_get(self):
        created = student_repo.create_student(full_name='Ana Perez', email='ana@udd.cl', rut='11.111.111-1')
        fetched = student_repo.get_student(created['id'])
        assert fetched['full_name'] == 'Ana Perez'
        assert fetched['rut'] == '11.111.111-1'

    def test_get_missing_returns_none(self):
        assert student_repo.get_student('missing') is None

    def test_student_exists(self):
        created = student_repo.create_student(full_name='Bruno Diaz', email='bruno@udd.cl', rut='2-2')
        assert student_repo.student_exists(created['id']) is True
        assert student_repo.student_exists('missing') is False

    def test_get_by_email(self):
        student_repo.create_student(full_name='Carla Soto', email='carla@udd.cl', rut='3-3')
        found = student_repo.get_student_by_email('carla@udd.cl')
        assert found['full_name'] == 'Carla Soto'

    def test_get_by_email_case_insensitive(self):
        student_repo.create_student(full_name='Diana Ruiz', email='diana@udd.cl', rut='4-4')
        found = student_repo.get_student_by_email('DIANA@UDD.cl')
        assert found['full_name'] == 'Diana Ruiz'

    def test_get_students_by_ids(self):
        s1 = student_repo.create_student(full_name='D1', email='d1@udd.cl', rut='4-4')
        s2 = student_repo.create_student(full_name='D2', email='d2@udd.cl', rut='5-5')
        result = student_repo.get_students_by_ids([s1['id'], s2['id'], 'missing'])
        assert set(result.keys()) == {s1['id'], s2['id']}

    def test_get_or_create_creates_when_missing(self):
        student, created = student_repo.get_or_create_student(email='e@udd.cl', full_name='E One', rut='6-6')
        assert created is True
        assert student['full_name'] == 'E One'

    def test_get_or_create_returns_existing(self):
        student_repo.create_student(full_name='F One', email='f@udd.cl', rut='7-7')
        student, created = student_repo.get_or_create_student(email='f@udd.cl', full_name='ignored', rut='ignored')
        assert created is False
        assert student['full_name'] == 'F One'

    def test_update_or_create_creates_when_missing(self):
        student, created = student_repo.update_or_create_student(email='g@udd.cl', full_name='G One', rut='8-8')
        assert created is True
        assert student['full_name'] == 'G One'

    def test_update_or_create_updates_existing(self):
        student_repo.create_student(full_name='Old Name', email='h@udd.cl', rut='9-9')
        student, created = student_repo.update_or_create_student(email='h@udd.cl', full_name='New Name', rut='10-10')
        assert created is False
        assert student['full_name'] == 'New Name'
        assert student['rut'] == '10-10'

    def test_list_students(self):
        student_repo.create_student(full_name='I1', email='i1@udd.cl', rut='11-11')
        student_repo.create_student(full_name='I2', email='i2@udd.cl', rut='12-12')
        names = {s['full_name'] for s in student_repo.list_students()}
        assert names == {'I1', 'I2'}


class StudentRaceConditionTest(DynamoDBTestCase):
    def test_create_student_duplicate_email_raises_value_error(self):
        """Verify that creating a student with a duplicate email raises ValueError."""
        student_repo.create_student(full_name='First', email='duplicate@udd.cl', rut='1-1')
        try:
            student_repo.create_student(full_name='Second', email='duplicate@udd.cl', rut='2-2')
            assert False, 'expected ValueError on duplicate email'
        except ValueError as e:
            assert 'already exists' in str(e)

    def test_get_or_create_handles_race_condition(self):
        """Simulate a race: manually create a student, then call get_or_create
        with the same email. Should return the existing student without error."""
        # Manually create a student with email 'race@udd.cl'
        existing = student_repo.create_student(
            full_name='Existing Student',
            email='race@udd.cl',
            rut='99-99'
        )

        # Now call get_or_create with the same email from "another thread"
        # This should detect the existing student and return it
        result, created = student_repo.get_or_create_student(
            email='race@udd.cl',
            full_name='Incoming Full Name',  # ignored
            rut='ignored'  # ignored
        )

        # Should return the existing student, created=False, no error
        assert created is False
        assert result['id'] == existing['id']
        assert result['full_name'] == 'Existing Student'  # unchanged
        assert result['rut'] == '99-99'  # unchanged

        # Verify no duplicate was created
        all_students = student_repo.list_students()
        assert len(all_students) == 1

    def test_update_or_create_handles_race_condition(self):
        """Simulate a race for update_or_create: manually create a student,
        then call update_or_create with the same email. Should return the
        existing student (updated), without error."""
        # Manually create a student
        existing = student_repo.create_student(
            full_name='Original Name',
            email='race-update@udd.cl',
            rut='88-88'
        )

        # Now call update_or_create with the same email
        result, created = student_repo.update_or_create_student(
            email='race-update@udd.cl',
            full_name='Updated Name',
            rut='77-77'
        )

        # Should return the existing student, updated, created=False, no error
        assert created is False
        assert result['id'] == existing['id']
        assert result['full_name'] == 'Updated Name'  # updated!
        assert result['rut'] == '77-77'  # updated!

        # Verify no duplicate was created
        all_students = student_repo.list_students()
        assert len(all_students) == 1

    def test_get_students_by_ids_excludes_reservation_items(self):
        """Verify reservation items don't leak into get_students_by_ids()."""
        s1 = student_repo.create_student(full_name='J1', email='j1@udd.cl', rut='j1-j1')
        result = student_repo.get_students_by_ids([s1['id']])
        # Should only get the student, not the reservation
        assert len(result) == 1
        assert s1['id'] in result
        assert result[s1['id']]['type'] == 'Student'

    def test_list_students_excludes_reservation_items(self):
        """Verify reservation items don't leak into list_students()."""
        student_repo.create_student(full_name='K1', email='k1@udd.cl', rut='k1-k1')
        student_repo.create_student(full_name='K2', email='k2@udd.cl', rut='k2-k2')
        students = student_repo.list_students()
        # Should only see Student items, not StudentEmailReservation items
        assert all(s['type'] == 'Student' for s in students)
        assert len(students) == 2
