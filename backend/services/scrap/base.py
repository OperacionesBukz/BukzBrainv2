from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Optional


@dataclass
class BookResult:
    source: str
    isbn: str
    titulo: Optional[str] = None
    autor: Optional[str] = None
    editorial: Optional[str] = None
    anio: Optional[int] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    portada_url: Optional[str] = None
    paginas: Optional[int] = None
    idioma: Optional[str] = None
    encuadernacion: Optional[str] = None
    found: bool = False
    error: Optional[str] = None


@dataclass
class MergedBook:
    isbn: str
    titulo: Optional[str] = None
    autor: Optional[str] = None
    editorial: Optional[str] = None
    anio: Optional[int] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    portada_url: Optional[str] = None
    paginas: Optional[int] = None
    idioma: Optional[str] = None
    encuadernacion: Optional[str] = None
    fuente_primaria: str = ""
    campos_encontrados: int = 0
    found: bool = False
    alertas: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> MergedBook:
        return cls(**{k: v for k, v in data.items() if k in cls.__dataclass_fields__})


class BookScraper(ABC):
    SOURCE_NAME: str = ""
    TIMEOUT: int = 10

    @abstractmethod
    def fetch(self, isbn: str) -> BookResult:
        ...
