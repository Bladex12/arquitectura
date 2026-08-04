from academic.dynamodb import faculty as faculty_repo
from academic.dynamodb import career as career_repo
from academic.dynamodb.testing import DynamoDBTestCase


class CareerRepoTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.faculty = faculty_repo.create_faculty(name='Ingeniería')

    def test_create_attaches_faculty_name(self):
        created = career_repo.create_career(faculty_id=self.faculty['id'], name='Informática')
        assert created['faculty_name'] == 'Ingeniería'

    def test_list_careers_for_faculty(self):
        career_repo.create_career(faculty_id=self.faculty['id'], name='Civil')
        other_faculty = faculty_repo.create_faculty(name='Medicina')
        career_repo.create_career(faculty_id=other_faculty['id'], name='Enfermería')

        careers = career_repo.list_careers(faculty_id=self.faculty['id'])
        assert len(careers) == 1
        assert careers[0]['name'] == 'Civil'

    def test_find_career_by_faculty_and_name(self):
        career_repo.create_career(faculty_id=self.faculty['id'], name='Industrial')
        found = career_repo.find_career(self.faculty['id'], 'Industrial')
        assert found is not None
        assert career_repo.find_career(self.faculty['id'], 'Nope') is None

    def test_update_recomputes_gsi_on_rename(self):
        created = career_repo.create_career(faculty_id=self.faculty['id'], name='Old Name')
        career_repo.update_career(created['id'], {'name': 'New Name'})
        careers = career_repo.list_careers(faculty_id=self.faculty['id'])
        assert careers[0]['name'] == 'New Name'

    def test_delete_restricted_when_has_courses(self):
        from academic.dynamodb import course as course_repo
        career = career_repo.create_career(faculty_id=self.faculty['id'], name='Con Cursos')
        course_repo.create_course(career_id=career['id'], name='Curso 1')
        try:
            career_repo.delete_career(career['id'])
            assert False, 'expected ValueError'
        except ValueError:
            pass
