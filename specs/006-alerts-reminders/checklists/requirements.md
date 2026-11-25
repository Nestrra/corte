# Specification Quality Checklist: Alertas y recordatorios

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-11-25
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Notes

- Iteración 1 (2026-11-25): fallaban dos ítems.
  - Un escenario de la historia 5 juntaba el 6 de diciembre el recordatorio de corte de la Visa con
    el de "Celular", que cae el 26.
  - La suposición del servicio de push nombraba EAS, development build y Expo Go.
  Se corrigieron los dos.
- Iteración 2 (2026-11-25): todos los ítems pasan sin marcas [NEEDS CLARIFICATION]. Las decisiones
  con un valor por defecto razonable quedaron en "Assumptions":
  - una alerta por compra con el umbral más alto (resuelve "un push por cada umbral" frente al
    criterio de una sola alerta);
  - texto con el uso real;
  - recordatorio de pago movido al día siguiente al corte;
  - sin recordatorios en $0;
  - recuperación del envío solo dentro del mismo día;
  - prueba solo a este dispositivo;
  - historial sin leídas;
  - sin avisos de mora.
- Expo Push se nombra solo como dependencia, porque lo fija la constitución (Restricciones
  técnicas → Notificaciones) y lo pidió el usuario. Los nombres de pantallas y el "hoy" del
  servidor siguen la convención de las specs anteriores.
- Revisión de cifras y fechas:
  - 1.300.000 + 600.000 = 1.900.000, el 95% de 2.000.000, así que cruza 70% y 90%.
  - Corte el 8 menos 2 días → 6 dic; fecha límite 25 dic menos 3 → 22 dic; vencimiento 28 dic
    menos 2 → 26 dic.
  - Corte el 31 en febrero de 2027 → 28 feb, recordatorio el 26 feb.
  - 10 mar de 2027 menos 15 → 23 feb.
  - Corte el 20 y límite el 22 con 3 días → 19 ≤ 20, se envía el 21.
- Items marked incomplete require spec updates before `/speckit-clarify` or `/speckit-plan`
