from academic.dynamodb import faculty as faculty_repo
from academic.dynamodb import career as career_repo
from academic.dynamodb import course as course_repo
from academic.dynamodb.testing import DynamoDBTestCase


class CourseRepoTest(DynamoDBTestCase):
    def setUp(self):
        super().setUp()
        self.faculty = faculty_repo.create_faculty(name='Ingeniería')
        self.career = career_repo.create_career(faculty_id=self.faculty['id'], name='Informática')

    def test_create_denormalizes_faculty_id(self):
        created = course_repo.create_course(career_id=self.career['id'], name='Emprendimiento')
        assert created['faculty_id'] == self.faculty['id']
        assert created['career_name'] == 'Informática'
        assert created['faculty_name'] == 'Ingeniería'

    def test_list_courses_for_career(self):
        course_repo.create_course(career_id=self.career['id'], name='Curso A')
        other_career = career_repo.create_career(faculty_id=self.faculty['id'], name='Civil')
        course_repo.create_course(career_id=other_career['id'], name='Curso B')

        courses = course_repo.list_courses(career_id=self.career['id'])
        assert len(courses) == 1
        assert courses[0]['name'] == 'Curso A'

    def test_get_courses_by_ids_carries_faculty_id(self):
        c1 = course_repo.create_course(career_id=self.career['id'], name='C1')
        c2 = course_repo.create_course(career_id=self.career['id'], name='C2')
        result = course_repo.get_courses_by_ids([c1['id'], c2['id']])
        assert result[c1['id']]['faculty_id'] == self.faculty['id']
        assert result[c2['id']]['faculty_id'] == self.faculty['id']
