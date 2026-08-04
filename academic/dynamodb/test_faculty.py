from academic.dynamodb import faculty as faculty_repo
from academic.dynamodb.testing import DynamoDBTestCase


class FacultyRepoTest(DynamoDBTestCase):
    def test_create_then_get(self):
        created = faculty_repo.create_faculty(name='Ingeniería', code='ING')
        fetched = faculty_repo.get_faculty(created['id'])
        assert fetched['name'] == 'Ingeniería'
        assert fetched['code'] == 'ING'
        assert fetched['is_active'] is True

    def test_get_missing_returns_none(self):
        assert faculty_repo.get_faculty('does-not-exist') is None

    def test_list_faculties_active_only(self):
        faculty_repo.create_faculty(name='Activa')
        faculty_repo.create_faculty(name='Inactiva', is_active=False)
        active = faculty_repo.list_faculties(active_only=True)
        names = {f['name'] for f in active}
        assert 'Activa' in names
        assert 'Inactiva' not in names

        everyone = faculty_repo.list_faculties()
        assert len(everyone) == 2

    def test_find_by_name(self):
        faculty_repo.create_faculty(name='Medicina')
        found = faculty_repo.find_faculty_by_name('Medicina')
        assert found is not None
        assert faculty_repo.find_faculty_by_name('Nope') is None

    def test_update_toggles_active_bucket(self):
        created = faculty_repo.create_faculty(name='Derecho')
        active_before = faculty_repo.list_faculties(active_only=True)
        assert any(f['id'] == created['id'] for f in active_before)

        faculty_repo.update_faculty(created['id'], {'is_active': False})
        active_after = faculty_repo.list_faculties(active_only=True)
        assert not any(f['id'] == created['id'] for f in active_after)

    def test_get_faculties_by_ids_batch(self):
        a = faculty_repo.create_faculty(name='A')
        b = faculty_repo.create_faculty(name='B')
        result = faculty_repo.get_faculties_by_ids([a['id'], b['id'], 'missing'])
        assert set(result.keys()) == {a['id'], b['id']}

    def test_delete_restricted_when_has_careers(self):
        from academic.dynamodb import career as career_repo
        faculty = faculty_repo.create_faculty(name='Con Carreras')
        career_repo.create_career(faculty_id=faculty['id'], name='Ing Civil')
        try:
            faculty_repo.delete_faculty(faculty['id'])
            assert False, 'expected ValueError'
        except ValueError:
            pass

    def test_delete_allowed_when_no_careers(self):
        faculty = faculty_repo.create_faculty(name='Sin Carreras')
        faculty_repo.delete_faculty(faculty['id'])
        assert faculty_repo.get_faculty(faculty['id']) is None
