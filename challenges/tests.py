from io import StringIO
from django.test import TestCase
from django.core.management import call_command
from challenges.services import generate_word_search
from challenges.models import AnagramWord, ChaosQuestion, GeneralKnowledgeQuestion


class GenerateWordSearchTest(TestCase):
    def test_long_word_is_filtered_not_raised(self):
        # 'creatividad' has 11 chars — previously raised ValueError
        result = generate_word_search(['creatividad', 'equipo'], seed=42)
        self.assertIsNotNone(result)
        words_in_result = [w.upper() for w in result['words']]
        self.assertNotIn('CREATIVIDAD', words_in_result)
        self.assertIn('EQUIPO', words_in_result)

    def test_all_long_words_uses_fallback(self):
        result = generate_word_search(['creatividad', 'emprendimiento'], seed=42)
        self.assertIsNotNone(result)
        self.assertGreater(len(result['words']), 0)

    def test_normal_words_work(self):
        result = generate_word_search(['equipo', 'lider'], seed=42)
        self.assertIsNotNone(result)
        words_in_result = [w.upper() for w in result['words']]
        self.assertIn('EQUIPO', words_in_result)


class CreateMinigameDataCommandTest(TestCase):
    def test_creates_anagram_words(self):
        call_command('create_minigame_data', stdout=StringIO())
        self.assertGreaterEqual(AnagramWord.objects.filter(is_active=True).count(), 15)

    def test_creates_chaos_questions(self):
        call_command('create_minigame_data', stdout=StringIO())
        self.assertGreaterEqual(ChaosQuestion.objects.filter(is_active=True).count(), 20)

    def test_creates_general_knowledge_questions(self):
        call_command('create_minigame_data', stdout=StringIO())
        self.assertGreaterEqual(GeneralKnowledgeQuestion.objects.filter(is_active=True).count(), 10)

    def test_idempotent(self):
        call_command('create_minigame_data', stdout=StringIO())
        count_anagram = AnagramWord.objects.count()
        count_chaos = ChaosQuestion.objects.count()
        count_gk = GeneralKnowledgeQuestion.objects.count()
        call_command('create_minigame_data', stdout=StringIO())
        self.assertEqual(AnagramWord.objects.count(), count_anagram)
        self.assertEqual(ChaosQuestion.objects.count(), count_chaos)
        self.assertEqual(GeneralKnowledgeQuestion.objects.count(), count_gk)

    def test_anagram_words_have_scrambled(self):
        call_command('create_minigame_data', stdout=StringIO())
        for word in AnagramWord.objects.filter(is_active=True):
            self.assertIsNotNone(word.scrambled_word)
            self.assertNotEqual(word.scrambled_word, '')

    def test_general_knowledge_correct_answer_valid(self):
        call_command('create_minigame_data', stdout=StringIO())
        for q in GeneralKnowledgeQuestion.objects.filter(is_active=True):
            self.assertIn(q.correct_answer, [0, 1, 2, 3])
