from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0019_user_push_token'),
    ]

    # blank false means the field cannot be blank in forms (input), but it can still be null in the database (can have no value)
    # null is considered empty in Django
    operations = [
        migrations.AddField(
            model_name='userdata',
            name='excitement',
            field=models.IntegerField(blank=False, null=True),
        ),
        migrations.AddField(
            model_name='userdata',
            name='frustration',
            field=models.IntegerField(blank=False, null=True),
        ),
        migrations.AddField(
            model_name='userdata',
            name='anger',
            field=models.IntegerField(blank=False, null=True),
        ),
        migrations.AddField(
            model_name='userdata',
            name='question_answers',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
