from challenges.dynamodb import anagram_word as anagram_repo
from challenges.dynamodb import chaos_question as chaos_repo
from challenges.dynamodb import general_knowledge_question as gk_repo
from challenges.dynamodb.testing import DynamoDBTestCase


class AnagramWordRepoTest(DynamoDBTestCase):
    def test_create_scrambles_word(self):
        created = anagram_repo.create_anagram_word(word='equipo')
        assert created['scrambled_word'] is not None
        assert sorted(created['scrambled_word']) == sorted('EQUIPO')

    def test_update_word_rescrambles(self):
        created = anagram_repo.create_anagram_word(word='lider')
        old_scramble = created['scrambled_word']
        updated = anagram_repo.update_anagram_word(created['id'], {'word': 'creativo'})
        assert updated['word'] == 'creativo'
        assert sorted(updated['scrambled_word']) == sorted('CREATIVO')
        assert updated['scrambled_word'] != old_scramble

    def test_list_active_only(self):
        anagram_repo.create_anagram_word(word='activa')
        anagram_repo.create_anagram_word(word='inactiva', is_active=False)
        active = anagram_repo.list_anagram_words(active_only=True)
        assert {w['word'] for w in active} == {'activa'}


class ChaosQuestionRepoTest(DynamoDBTestCase):
    def test_create_then_list(self):
        chaos_repo.create_chaos_question(question='¿Qué harías?')
        questions = chaos_repo.list_chaos_questions(active_only=True)
        assert len(questions) == 1


class GeneralKnowledgeQuestionRepoTest(DynamoDBTestCase):
    def test_create_then_get(self):
        created = gk_repo.create_general_knowledge_question(
            question='¿Capital de Chile?', option_a='Santiago', option_b='Lima',
            option_c='Bogotá', option_d='Quito', correct_answer=0,
        )
        fetched = gk_repo.get_general_knowledge_question(created['id'])
        assert fetched['correct_answer'] == 0
        assert fetched['option_a'] == 'Santiago'
