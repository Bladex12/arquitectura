from users.dynamodb import user as user_repo
from users.dynamodb.testing import DynamoDBTestCase


class CreateAndGetUserTest(DynamoDBTestCase):
    def test_create_then_get_by_id(self):
        created = user_repo.create_user(username='jdoe', email='jdoe@udd.cl', password='pw12345!')
        fetched = user_repo.get_user_by_id(created['id'])
        assert fetched['username'] == 'jdoe'
        assert fetched['email'] == 'jdoe@udd.cl'
        assert fetched['is_administrator'] is False
        assert fetched['password_hash'] != 'pw12345!'  # hashed, not plaintext

    def test_get_by_id_missing_returns_none(self):
        assert user_repo.get_user_by_id('does-not-exist') is None

    def test_duplicate_username_raises(self):
        user_repo.create_user(username='jdoe', email='a@udd.cl', password='pw12345!')
        try:
            user_repo.create_user(username='jdoe', email='b@udd.cl', password='pw12345!')
            assert False, 'expected ValueError'
        except ValueError:
            pass

    def test_get_by_username(self):
        user_repo.create_user(username='msmith', email='msmith@udd.cl', password='pw12345!')
        found = user_repo.get_user_by_username('msmith')
        assert found['email'] == 'msmith@udd.cl'

    def test_get_by_username_missing_returns_none(self):
        assert user_repo.get_user_by_username('nobody') is None

    def test_get_by_email(self):
        user_repo.create_user(username='asmith', email='asmith@udd.cl', password='pw12345!')
        found = user_repo.get_user_by_email('asmith@udd.cl')
        assert found['username'] == 'asmith'

    def test_get_by_email_case_insensitive(self):
        user_repo.create_user(username='bsmith', email='bsmith@udd.cl', password='pw12345!')
        found = user_repo.get_user_by_email('BSmith@UDD.cl')
        assert found['username'] == 'bsmith'

    def test_password_hash_passthrough(self):
        created = user_repo.create_user(username='csmith', email='c@udd.cl', password_hash='pbkdf2_sha256$prehashed')
        assert created['password_hash'] == 'pbkdf2_sha256$prehashed'

    def test_check_user_password(self):
        created = user_repo.create_user(username='dsmith', email='d@udd.cl', password='correct-horse')
        assert user_repo.check_user_password(created, 'correct-horse') is True
        assert user_repo.check_user_password(created, 'wrong') is False

    def test_get_users_by_ids(self):
        u1 = user_repo.create_user(username='u1', email='u1@udd.cl', password='pw12345!')
        u2 = user_repo.create_user(username='u2', email='u2@udd.cl', password='pw12345!')
        result = user_repo.get_users_by_ids([u1['id'], u2['id'], 'missing-id'])
        assert set(result.keys()) == {u1['id'], u2['id']}

    def test_get_users_by_ids_empty_list(self):
        assert user_repo.get_users_by_ids([]) == {}

    def test_get_users_by_ids_excludes_reservation_items(self):
        """Verify reservation items don't leak into get_users_by_ids()."""
        u1 = user_repo.create_user(username='i1', email='i1@udd.cl', password='pw12345!')
        result = user_repo.get_users_by_ids([u1['id']])
        # Should only get the user, not the reservation
        assert len(result) == 1
        assert u1['id'] in result
        assert result[u1['id']]['type'] == 'User'

    def test_list_users_and_count(self):
        user_repo.create_user(username='e1', email='e1@udd.cl', password='pw12345!')
        user_repo.create_user(username='e2', email='e2@udd.cl', password='pw12345!')
        assert user_repo.count_users() == 2
        usernames = {u['username'] for u in user_repo.list_users()}
        assert usernames == {'e1', 'e2'}

    def test_update_user(self):
        created = user_repo.create_user(username='f1', email='f1@udd.cl', password='pw12345!')
        user_repo.update_user(created['id'], {'first_name': 'Frank', 'is_administrator': True})
        fetched = user_repo.get_user_by_id(created['id'])
        assert fetched['first_name'] == 'Frank'
        assert fetched['is_administrator'] is True

    def test_delete_user(self):
        created = user_repo.create_user(username='g1', email='g1@udd.cl', password='pw12345!')
        user_repo.delete_user(created['id'])
        assert user_repo.get_user_by_id(created['id']) is None

    def test_list_users_excludes_reservation_items(self):
        """Verify reservation items don't leak into list_users()."""
        user_repo.create_user(username='h1', email='h1@udd.cl', password='pw12345!')
        user_repo.create_user(username='h2', email='h2@udd.cl', password='pw12345!')
        users = user_repo.list_users()
        # Should only see User items, not UsernameReservation items
        assert all(u['type'] == 'User' for u in users)
        assert len(users) == 2

    def test_reuse_username_after_deletion(self):
        """Verify a username can be reused after the original user is deleted."""
        # Create and delete a user with username 'reusable'
        created1 = user_repo.create_user(username='reusable', email='first@udd.cl', password='pw12345!')
        user_repo.delete_user(created1['id'])

        # Now create a new user with the same username
        created2 = user_repo.create_user(username='reusable', email='second@udd.cl', password='pw12345!')

        # Verify the new user exists and has a different ID
        assert created2['id'] != created1['id']
        assert user_repo.get_user_by_username('reusable')['id'] == created2['id']
