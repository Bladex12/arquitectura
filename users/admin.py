"""
Admin para la app users
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User
from .models import Administrator, Professor, Student, ProfessorAccessCode


@admin.register(Administrator)
class AdministratorAdmin(admin.ModelAdmin):
    list_display = ['user', 'is_super_admin', 'created_at']
    list_filter = ['is_super_admin', 'created_at']
    search_fields = ['user__username', 'user__email', 'user__first_name', 'user__last_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Professor)
class ProfessorAdmin(admin.ModelAdmin):
    list_display = ['user', 'access_code', 'created_at']
    list_filter = ['created_at']
    search_fields = ['user__username', 'user__email', 'user__first_name', 'user__last_name', 'access_code']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ProfessorAccessCode)
class ProfessorAccessCodeAdmin(admin.ModelAdmin):
    list_display = ['email', 'access_code', 'is_used', 'created_at', 'used_at']
    list_filter = ['is_used', 'created_at']
    search_fields = ['email', 'access_code']
    readonly_fields = ['created_at', 'used_at']
    ordering = ['-created_at']


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'email', 'rut', 'created_at']
    list_filter = ['created_at']
    search_fields = ['full_name', 'email', 'rut']
    readonly_fields = ['created_at', 'updated_at']
