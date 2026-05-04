"""Mapping profile + rules (Books by Rudra v2)."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class MappingProfile(Base):
    __tablename__ = "mapping_profiles"
    __table_args__ = ()

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    profile_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    rules: Mapped[list[MappingRule]] = relationship(
        "MappingRule", back_populates="profile", cascade="all, delete-orphan"
    )


class MappingRule(Base):
    __tablename__ = "mapping_rules"
    __table_args__ = (UniqueConstraint("profile_id", "canonical_key", name="uq_mapping_rules_profile_key"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("mapping_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    canonical_key: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    zoho_account_id: Mapped[str] = mapped_column(String(100), nullable=False)
    zoho_account_name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    document_kind: Mapped[str] = mapped_column(String(40), nullable=False)
    formula_expr: Mapped[str | None] = mapped_column(Text, nullable=True)
    tax_rate: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sign_hint: Mapped[str] = mapped_column(String(20), nullable=False, default="auto")
    condition_expr: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    profile: Mapped[MappingProfile] = relationship("MappingProfile", back_populates="rules")
