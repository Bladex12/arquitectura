"""
Admin para la app academic
"""
from django.contrib import admin
from .models import Faculty, Career, Course


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active', 'created_at']
    list_filter = ['is_active', 'created_at']
    search_fields = ['name', 'code']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Career)
class CareerAdmin(admin.ModelAdmin):
    list_display = ['name', 'faculty', 'code', 'is_active', 'created_at']
    list_filter = ['faculty', 'is_active', 'created_at']
    search_fields = ['name', 'code', 'faculty__name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'career', 'code', 'is_active', 'created_at']
    list_filter = ['career', 'is_active', 'created_at']
    search_fields = ['name', 'code', 'career__name']
    readonly_fields = ['created_at', 'updated_at']
