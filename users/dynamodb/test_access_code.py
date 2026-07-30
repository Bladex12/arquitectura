from users.dynamodb import access_code as access_code_repo
from users.dynamodb.testing import DynamoDBTestCase


class AccessCodeTest(DynamoDBTestCase):
    def test_create_then_get(self):
        access_code_repo.create_access_code('prof@udd.cl', '111111')
        fetched = access_code_repo.get_access_code('111111')
        assert fetched['email'] == 'prof@udd.cl'
        assert fetched['is_used'] is False

    def test_get_missing_returns_none(self):
        assert access_code_repo.get_access_code('999999') is None

    def test_duplicate_code_raises(self):
        access_code_repo.create_access_code('a@udd.cl', '222222')
        try:
            access_code_repo.create_access_code('b@udd.cl', '222222')
            assert False, 'expected ValueError'
        except ValueError:
            pass

    def test_pending_by_email_found(self):
        access_code_repo.create_access_code('c@udd.cl', '333333')
        found = access_code_repo.get_pending_access_code_by_email('c@udd.cl')
        assert found['access_code'] == '333333'

    def test_pending_by_email_ignores_used(self):
        access_code_repo.create_access_code('d@udd.cl', '444444')
        access_code_repo.mark_access_code_used('444444')
        assert access_code_repo.get_pending_access_code_by_email('d@udd.cl') is None

    def test_pending_by_email_none_found(self):
        assert access_code_repo.get_pending_access_code_by_email('nobody@udd.cl') is None

    def test_mark_used(self):
        access_code_repo.create_access_code('e@udd.cl', '555555')
        access_code_repo.mark_access_code_used('555555')
        fetched = access_code_repo.get_access_code('555555')
        assert fetched['is_used'] is True
        assert fetched['used_at'] is not None

    def test_list_access_codes_newest_first(self):
        access_code_repo.create_access_code('f@udd.cl', '666666')
        access_code_repo.create_access_code('g@udd.cl', '777777')
        codes = access_code_repo.list_access_codes()
        assert [c['access_code'] for c in codes] == ['777777', '666666']
