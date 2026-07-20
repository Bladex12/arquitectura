from unittest import TestCase

from game_sessions.dynamodb import keys


class KeysTest(TestCase):
    def test_session_pk(self):
        self.assertEqual(keys.session_pk('ABC123'), 'SESSION#ABC123')

    def test_session_group_pk(self):
        self.assertEqual(keys.session_group_pk('grp-1'), 'SESSIONGROUP#grp-1')

    def test_tablet_pk(self):
        self.assertEqual(keys.tablet_pk('T-01'), 'TABLET#T-01')

    def test_metadata_sk(self):
        self.assertEqual(keys.metadata_sk(), 'METADATA')

    def test_team_sk(self):
        self.assertEqual(keys.team_sk('team-1'), 'TEAM#team-1#METADATA')

    def test_team_prefix(self):
        self.assertEqual(keys.team_prefix('team-1'), 'TEAM#team-1#')
        self.assertTrue(keys.team_sk('team-1').startswith(keys.team_prefix('team-1')))
        self.assertTrue(keys.progress_sk('team-1', 'act-1').startswith(keys.team_prefix('team-1')))

    def test_stage_sk(self):
        self.assertEqual(keys.stage_sk(3), 'STAGE#3')

    def test_progress_sk(self):
        self.assertEqual(keys.progress_sk('team-1', 'act-1'), 'TEAM#team-1#PROGRESS#act-1')

    def test_bubble_map_sk(self):
        self.assertEqual(keys.bubble_map_sk('team-1', 2), 'TEAM#team-1#BUBBLEMAP#2')

    def test_tablet_connection_sk(self):
        self.assertEqual(keys.tablet_connection_sk('tok-1'), 'TABLETCONN#tok-1')

    def test_roulette_sk(self):
        self.assertEqual(keys.roulette_sk('team-1', 3), 'TEAM#team-1#ROULETTE#3')

    def test_token_tx_sk_for_source(self):
        self.assertEqual(
            keys.token_tx_sk_for_source('activity', 42),
            'TOKENTX#activity#42',
        )

    def test_token_tx_sk_for_manual(self):
        self.assertEqual(
            keys.token_tx_sk_for_manual('2026-07-19T10:00:00+00:00', 'uuid-1'),
            'TOKENTX#2026-07-19T10:00:00+00:00#uuid-1',
        )

    def test_peer_eval_sk(self):
        self.assertEqual(keys.peer_eval_sk('team-1', 'team-2'), 'PEEREVAL#team-1#team-2')

    def test_reflection_sk(self):
        self.assertEqual(keys.reflection_sk('uuid-1'), 'REFLECTION#uuid-1')

    def test_professor_gsi1pk(self):
        self.assertEqual(keys.professor_gsi1pk(7), 'PROFESSOR#7')

    def test_session_gsi1sk(self):
        self.assertEqual(
            keys.session_gsi1sk('lobby', '2026-07-19T10:00:00+00:00'),
            'lobby#2026-07-19T10:00:00+00:00',
        )
