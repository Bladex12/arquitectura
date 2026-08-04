"""
Frozen copy of the original Django ORM models for `academic`, kept ONLY
so challenges/management/commands/backfill_content_to_dynamodb.py can
still read prod MySQL data after academic/models.py became a DynamoDB
compatibility shim (see
docs/superpowers/specs/2026-08-03-academic-challenges-dynamodb-migration-design.md).

Not imported anywhere else. Do not add new fields here or use these
classes for anything but the one-time backfill -- academic/models.py is
the real API surface now.
"""
from django.db import models


class Faculty(models.Model):
    name = models.CharField(max_length=200, unique=True)
    code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'academic'
        db_table = 'faculties'
        managed = False

    def __str__(self):
        return self.name


class Career(models.Model):
    faculty = models.ForeignKey(Faculty, on_delete=models.RESTRICT, related_name='+')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'academic'
        db_table = 'careers'
        managed = False

    def __str__(self):
        return f"{self.name} - {self.faculty.name}"


class Course(models.Model):
    career = models.ForeignKey(Career, on_delete=models.RESTRICT, related_name='+')
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'academic'
        db_table = 'courses'
        managed = False

    def __str__(self):
        return f"{self.name} - {self.career.name}"
