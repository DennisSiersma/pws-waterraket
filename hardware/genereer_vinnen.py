#!/usr/bin/env python3
"""
Fin can (vinnenmanchet) voor de waterraket.

Een manchet die om de fles klemt met drie of vier vinnen eraan. Geen lijm nodig:
een tiewrap in de groef onderaan houdt hem vast. De manchet laat de onderste rand
vrij, zodat de klemmen van de split-collar launcher erbij kunnen.

Genereert drie maten met BEKEND vinoppervlak, zodat je vinoppervlak als
gecontroleerde variabele kunt gebruiken:
    klein / midden / groot

Meet je fles en pas FLES_D aan. Draaien:
    ../../.venv/bin/python genereer_vinnen.py
Print staand (manchet rechtop), zonder supports. PETG of TPU is taaier dan PLA.
"""
import numpy as np, trimesh

# ---------------- maten in mm ----------------
# Gemeten aan de Fernandes-fles: onderaan (halszijde) loopt hij over ~30 mm taps
# van omtrek 264 naar 278 mm, oftewel diameter 84,0 -> 88,5 mm.
# De manchet krijgt dezelfde conus: hij wigt zichzelf vast, staat altijd recht
# en kan niet naar de hals zakken. Meet je fles opnieuw, pas deze drie aan.
FLES_D    = 88.5     # diameter van het cilindrische deel
FLES_D2   = 84.0     # diameter onderaan de conus (halszijde)
FLES_TAPS = 30.0     # lengte van het taps toelopende stuk
FLES_SPEL = 0.6      # speling zodat de manchet er soepel overheen gaat
WAND      = 2.0      # wanddikte manchet
MANCHET_MARGE = 6.0  # manchet loopt zover door boven de vinwortel
VIN_N     = 3        # aantal vinnen (3 = minder weerstand, 4 = stabieler)
VIN_DIK   = 2.4      # dikte van de vin
GROEF_H   = 6.0      # hoogte van de tiewrap-groef onderaan
GROEF_D   = 1.2      # diepte van de tiewrap-groef
VRIJ_ONDER = 12.0    # vrije rand onderaan voor de launcher-klemmen
SEG       = 96

# drie maten: (naam, spanwijdte vanaf de manchet, wortelkoorde, tipkoorde)
MATEN = [
    ("klein",  45.0, 60.0, 26.0),
    ("midden", 58.0, 70.0, 30.0),
    ("groot",  72.0, 82.0, 34.0),
]

ID = FLES_D + FLES_SPEL
OD = ID + 2 * WAND


def pijp(d_out, d_in, h, z0):
    a = trimesh.creation.cylinder(radius=d_out / 2, height=h, sections=SEG)
    a.apply_translation((0, 0, z0 + h / 2))
    b = trimesh.creation.cylinder(radius=d_in / 2, height=h + 2, sections=SEG)
    b.apply_translation((0, 0, z0 + h / 2))
    return trimesh.boolean.difference([a, b], engine='manifold')


def boring(h):
    """Binnenvorm: onderaan conus (halszijde), daarboven cilindrisch."""
    r1, r2 = (FLES_D2 + FLES_SPEL) / 2, ID / 2
    pts = [[0, -1], [r1, -1], [r1, 0], [r2, FLES_TAPS], [r2, h + 1], [0, h + 1]]
    return trimesh.creation.revolve(np.array(pts), sections=SEG)


def vin(span, wortel, tip, hoek):
    """Trapeziumvin met pijlstelling; wortel op de manchet, tip naar buiten."""
    r0 = ID / 2                             # wortel door de hele wand: sterke hechting
    r1 = r0 + span
    z0 = VRIJ_ONDER + 2.0                   # begint boven de vrije rand
    sweep = 14.0                            # pijlstelling: tip iets naar achteren
    punten = np.array([
        [r0, z0],
        [r0, z0 + wortel],
        [r1, z0 + sweep + tip],
        [r1, z0 + sweep],
    ])
    # profiel naar 3D: vlak in het xz-vlak, dikte in y
    v2 = trimesh.creation.extrude_polygon(
        __import__('shapely').geometry.Polygon(punten), height=VIN_DIK)
    # extrude staat in xy met dikte z -> kantelen zodat dikte in y komt
    v2.apply_transform(trimesh.transformations.rotation_matrix(np.pi / 2, [1, 0, 0]))
    v2.apply_translation((0, VIN_DIK / 2, 0))
    v2.apply_transform(trimesh.transformations.rotation_matrix(hoek, [0, 0, 1]))
    return v2


def bouw(naam, span, wortel, tip):
    # manchet altijd hoger dan de vinwortel, anders steekt de vin los uit
    manchet_h = VRIJ_ONDER + 2.0 + wortel + MANCHET_MARGE
    buis = trimesh.creation.cylinder(radius=OD / 2, height=manchet_h, sections=SEG)
    buis.apply_translation((0, 0, manchet_h / 2))
    delen = [trimesh.boolean.difference([buis, boring(manchet_h)], engine='manifold')]
    for i in range(VIN_N):
        delen.append(vin(span, wortel, tip, 2 * np.pi * i / VIN_N))
    m = trimesh.boolean.union(delen, engine='manifold')

    # tiewrap-groef onderaan
    groef = pijp(OD + 2, OD - 2 * GROEF_D, GROEF_H, VRIJ_ONDER - GROEF_H - 1)
    m = trimesh.boolean.difference([m, groef], engine='manifold')

    bestand = 'PWS_Waterraket_Vinnen_%s.stl' % naam
    m.export(bestand)

    # vinoppervlak per vin (trapezium), in cm2
    opp = 0.5 * (wortel + tip) * span / 100.0
    e = m.bounding_box.extents
    print("%-7s %d vinnen  spanwijdte %.0f mm  %.1f cm2/vin  totaal %.1f cm2  "
          "| %.0f x %.0f x %.0f mm  %.0f g PLA  waterdicht: %s"
          % (naam, VIN_N, span, opp, opp * VIN_N, e[0], e[1], e[2],
             m.volume / 1000 * 1.24 * 0.6, m.is_watertight))


print("fles %.1f mm  ->  manchet binnen %.1f, buiten %.1f mm" % (FLES_D, ID, OD))
for naam, span, wortel, tip in MATEN:
    bouw(naam, span, wortel, tip)
