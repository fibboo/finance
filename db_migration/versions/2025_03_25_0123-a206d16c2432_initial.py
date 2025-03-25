"""Initial

Revision ID: a206d16c2432
Revises: 
Create Date: 2025-03-25 01:23:54.270311

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a206d16c2432'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('accounts',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('description', sa.String(length=4096), nullable=True),
    sa.Column('balance', sa.Numeric(), server_default='0', nullable=False),
    sa.Column('currency', sa.String(length=24), nullable=False),
    sa.Column('base_currency_rate', sa.Numeric(), server_default='0', nullable=False),
    sa.Column('account_type', sa.String(length=24), nullable=False),
    sa.Column('status', sa.String(length=24), server_default='ACTIVE', nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name', name='account_unique_user_id_name')
    )
    op.create_index(op.f('ix_accounts_name'), 'accounts', ['name'], unique=False)
    op.create_index(op.f('ix_accounts_status'), 'accounts', ['status'], unique=False)
    op.create_index(op.f('ix_accounts_user_id'), 'accounts', ['user_id'], unique=False)
    op.create_table('categories',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('description', sa.String(length=4096), nullable=True),
    sa.Column('type', sa.String(length=24), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name', name='category_unique_user_id_name')
    )
    op.create_index(op.f('ix_categories_name'), 'categories', ['name'], unique=False)
    op.create_index(op.f('ix_categories_type'), 'categories', ['type'], unique=False)
    op.create_index(op.f('ix_categories_user_id'), 'categories', ['user_id'], unique=False)
    op.create_table('income_sources',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('description', sa.String(length=4096), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'name', name='income_source_unique_user_id_name')
    )
    op.create_index(op.f('ix_income_sources_name'), 'income_sources', ['name'], unique=False)
    op.create_index(op.f('ix_income_sources_user_id'), 'income_sources', ['user_id'], unique=False)
    op.create_table('locations',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('name', sa.String(length=64), nullable=False),
    sa.Column('description', sa.String(length=4096), nullable=True),
    sa.Column('coordinates', sa.String(length=64), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('coordinates'),
    sa.UniqueConstraint('user_id', 'name', name='location_unique_user_id_name')
    )
    op.create_index(op.f('ix_locations_name'), 'locations', ['name'], unique=False)
    op.create_index(op.f('ix_locations_user_id'), 'locations', ['user_id'], unique=False)
    op.create_table('transactions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('transaction_date', sa.Date(), nullable=False),
    sa.Column('base_currency_amount', sa.Numeric(), nullable=False),
    sa.Column('source_amount', sa.Numeric(), nullable=False),
    sa.Column('source_currency', sa.String(length=24), nullable=False),
    sa.Column('destination_amount', sa.Numeric(), nullable=False),
    sa.Column('destination_currency', sa.String(length=24), nullable=False),
    sa.Column('transaction_type', sa.String(length=24), nullable=False),
    sa.Column('status', sa.String(length=24), server_default='ACTIVE', nullable=False),
    sa.Column('comment', sa.String(length=256), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_base_currency_amount'), 'transactions', ['base_currency_amount'], unique=False)
    op.create_index(op.f('ix_transactions_source_amount'), 'transactions', ['source_amount'], unique=False)
    op.create_index(op.f('ix_transactions_status'), 'transactions', ['status'], unique=False)
    op.create_index(op.f('ix_transactions_transaction_date'), 'transactions', ['transaction_date'], unique=False)
    op.create_index(op.f('ix_transactions_transaction_type'), 'transactions', ['transaction_type'], unique=False)
    op.create_index(op.f('ix_transactions_user_id'), 'transactions', ['user_id'], unique=False)
    op.create_table('users',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('username', sa.String(length=64), nullable=False),
    sa.Column('avatar', sa.String(length=2560), nullable=True),
    sa.Column('registration_provider', sa.String(length=24), nullable=False),
    sa.Column('base_currency', sa.String(length=24), server_default='USD', nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_users_username'), 'users', ['username'], unique=True)
    op.create_table('external_users',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('provider', sa.String(length=24), nullable=False),
    sa.Column('external_id', sa.String(), nullable=False),
    sa.Column('username', sa.String(), nullable=False),
    sa.Column('first_name', sa.String(), nullable=True),
    sa.Column('last_name', sa.String(), nullable=True),
    sa.Column('avatar', sa.String(), nullable=True),
    sa.Column('profile_url', sa.String(), nullable=True),
    sa.Column('email', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_external_users_external_id'), 'external_users', ['external_id'], unique=False)
    op.create_index(op.f('ix_external_users_provider'), 'external_users', ['provider'], unique=False)
    op.create_index(op.f('ix_external_users_username'), 'external_users', ['username'], unique=False)
    op.create_table('sessions',
    sa.Column('id', sa.UUID(), server_default=sa.text('gen_random_uuid()'), nullable=False),
    sa.Column('user_id', sa.UUID(), nullable=False),
    sa.Column('expires_at', sa.DateTime(), nullable=False),
    sa.Column('provider', sa.String(length=24), nullable=False),
    sa.Column('access_token', sa.String(), nullable=True),
    sa.Column('token_type', sa.String(), nullable=True),
    sa.Column('expires_in', sa.BigInteger(), nullable=True),
    sa.Column('refresh_token', sa.String(), nullable=True),
    sa.Column('scope', sa.String(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sessions_provider'), 'sessions', ['provider'], unique=False)
    op.create_table('transactions_expense',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('from_account_id', sa.UUID(), nullable=False),
    sa.Column('category_id', sa.UUID(), nullable=False),
    sa.Column('location_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['category_id'], ['categories.id'], ),
    sa.ForeignKeyConstraint(['from_account_id'], ['accounts.id'], ),
    sa.ForeignKeyConstraint(['id'], ['transactions.id'], ),
    sa.ForeignKeyConstraint(['location_id'], ['locations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_expense_category_id'), 'transactions_expense', ['category_id'], unique=False)
    op.create_index(op.f('ix_transactions_expense_from_account_id'), 'transactions_expense', ['from_account_id'], unique=False)
    op.create_index(op.f('ix_transactions_expense_location_id'), 'transactions_expense', ['location_id'], unique=False)
    op.create_table('transactions_income',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('income_period', sa.Date(), nullable=False),
    sa.Column('income_source_id', sa.UUID(), nullable=False),
    sa.Column('to_account_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['id'], ['transactions.id'], ),
    sa.ForeignKeyConstraint(['income_source_id'], ['income_sources.id'], ),
    sa.ForeignKeyConstraint(['to_account_id'], ['accounts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_income_income_period'), 'transactions_income', ['income_period'], unique=False)
    op.create_index(op.f('ix_transactions_income_income_source_id'), 'transactions_income', ['income_source_id'], unique=False)
    op.create_index(op.f('ix_transactions_income_to_account_id'), 'transactions_income', ['to_account_id'], unique=False)
    op.create_table('transactions_transfer',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('from_account_id', sa.UUID(), nullable=False),
    sa.Column('to_account_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['from_account_id'], ['accounts.id'], ),
    sa.ForeignKeyConstraint(['id'], ['transactions.id'], ),
    sa.ForeignKeyConstraint(['to_account_id'], ['accounts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_transactions_transfer_from_account_id'), 'transactions_transfer', ['from_account_id'], unique=False)
    op.create_index(op.f('ix_transactions_transfer_to_account_id'), 'transactions_transfer', ['to_account_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_transactions_transfer_to_account_id'), table_name='transactions_transfer')
    op.drop_index(op.f('ix_transactions_transfer_from_account_id'), table_name='transactions_transfer')
    op.drop_table('transactions_transfer')
    op.drop_index(op.f('ix_transactions_income_to_account_id'), table_name='transactions_income')
    op.drop_index(op.f('ix_transactions_income_income_source_id'), table_name='transactions_income')
    op.drop_index(op.f('ix_transactions_income_income_period'), table_name='transactions_income')
    op.drop_table('transactions_income')
    op.drop_index(op.f('ix_transactions_expense_location_id'), table_name='transactions_expense')
    op.drop_index(op.f('ix_transactions_expense_from_account_id'), table_name='transactions_expense')
    op.drop_index(op.f('ix_transactions_expense_category_id'), table_name='transactions_expense')
    op.drop_table('transactions_expense')
    op.drop_index(op.f('ix_sessions_provider'), table_name='sessions')
    op.drop_table('sessions')
    op.drop_index(op.f('ix_external_users_username'), table_name='external_users')
    op.drop_index(op.f('ix_external_users_provider'), table_name='external_users')
    op.drop_index(op.f('ix_external_users_external_id'), table_name='external_users')
    op.drop_table('external_users')
    op.drop_index(op.f('ix_users_username'), table_name='users')
    op.drop_table('users')
    op.drop_index(op.f('ix_transactions_user_id'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_transaction_type'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_transaction_date'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_status'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_source_amount'), table_name='transactions')
    op.drop_index(op.f('ix_transactions_base_currency_amount'), table_name='transactions')
    op.drop_table('transactions')
    op.drop_index(op.f('ix_locations_user_id'), table_name='locations')
    op.drop_index(op.f('ix_locations_name'), table_name='locations')
    op.drop_table('locations')
    op.drop_index(op.f('ix_income_sources_user_id'), table_name='income_sources')
    op.drop_index(op.f('ix_income_sources_name'), table_name='income_sources')
    op.drop_table('income_sources')
    op.drop_index(op.f('ix_categories_user_id'), table_name='categories')
    op.drop_index(op.f('ix_categories_type'), table_name='categories')
    op.drop_index(op.f('ix_categories_name'), table_name='categories')
    op.drop_table('categories')
    op.drop_index(op.f('ix_accounts_user_id'), table_name='accounts')
    op.drop_index(op.f('ix_accounts_status'), table_name='accounts')
    op.drop_index(op.f('ix_accounts_name'), table_name='accounts')
    op.drop_table('accounts')
    # ### end Alembic commands ###
