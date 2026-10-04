#!/usr/bin/env python3
"""
Elektronicatray in TWEE HELFTEN.

Een hele schijf van 89 mm past door geen enkele opening van de romp: de
schroefdraad laat 85 mm door, het gat in de richel 83,5, en het servoplankje
steekt 27 mm naar binnen. Twee helften van 42 mm breed gaan er zo doorheen.

  Tray_A   het bord (scherm omhoog)
  Tray_B   accu en sensor

Samen vormen ze een schijf van 82 mm op de bayvloer; de naad ligt 1,5 mm uit
het midden zodat het bord over het midden kan liggen. Het schotje erboven houdt ze op hun plek.

Draaien:  ../../.venv/bin/python genereer_tray.py
Print plat, geen supports.
"""
import numpy as np
import trimesh

TRAY_D = 82.0       # past plat door de draad (85,1) en door het richelgat (83,5)
BASIS  = 2.0
HOOGTE = 13.0
WAND   = 1.8        # minimale wand aan de buitenrand
SPLIT  = 2.5        # de naad ligt niet in het midden: het bord moet over het midden heen
SEG    = 96

# per helft: (naam, breedte x, diepte y, hoogte, middelpunt x, middelpunt y)
HELFT_A = [("bord",   33.13 + 0.6, 41.13 + 0.6, 7.5, -16.2,  0.0)]      # over het midden: hoeken blijven binnen de boog
HELFT_B = [("accu",   27.0 + 1.2, 22.0 + 1.2, 10.5,  18.1,  10.0),     # een kwartslag gedraaid
           ("sensor", 18.0 + 1.0, 24.0 + 1.0,  8.0,  13.5, -15.5)]


def balk(sx, sy, sz, cx, cy, z0):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((cx, cy, z0 + sz / 2))
    return m


r = TRAY_D / 2
schijf = trimesh.creation.cylinder(radius=r, height=HOOGTE, sections=SEG)
schijf.apply_translation((0, 0, HOOGTE / 2))
groot = 2 * r + 10


def helft(naam, kant, vakken):
    """kant -1: x <= SPLIT (grote helft, met het bord); kant +1: x >= SPLIT (accu en sensor)."""
    if kant < 0:
        m = trimesh.boolean.intersection([schijf, balk(groot, groot, 30, -groot / 2 + SPLIT, 0, -5)], engine='manifold')
    else:
        m = trimesh.boolean.intersection([schijf, balk(groot, groot, 30, groot / 2 + SPLIT, 0, -5)], engine='manifold')
    weg = balk(0.01, 0.01, 0.01, 200, 200, 200)                                 # (geen lipzone meer)
    gaten = [weg]
    for vn, bx, by, bz, cx, cy in vakken:
        gaten.append(balk(bx, by, bz + 1.0, cx, cy, HOOGTE - bz))
        g = trimesh.creation.cylinder(radius=5.0, height=BASIS + 2, sections=32)
        g.apply_translation((cx, cy, BASIS / 2))
        gaten.append(g)
        hoek_r = max(np.hypot(cx + sx, cy + sy) for sx in (-bx / 2, bx / 2) for sy in (-by / 2, by / 2))
        naad = (SPLIT - (cx + bx / 2)) if kant < 0 else ((cx - bx / 2) - SPLIT)
        print("  %-7s hoek op straal %.1f (max %.1f) %s | %.1f mm wand tot de naad %s"
              % (vn, hoek_r, r - WAND, "ok" if hoek_r <= r - WAND else "RAND",
                 naad, "ok" if naad >= 1.5 else "NAAD"))
    gaten.append(balk(5.0, 8.0, HOOGTE, SPLIT + kant * 2.0, 0.0, HOOGTE - 6.0))   # kabelgoot naar de naad
    m = trimesh.boolean.difference([m] + gaten, engine='manifold')
    m.merge_vertices(); m.update_faces(m.nondegenerate_faces())
    m.update_faces(m.unique_faces()); m.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(m)
    best = 'PWS_Waterraket_Tray_%s.stl' % naam
    m.export(best)
    t = trimesh.load(best); e = t.bounding_box.extents
    print("%s: %.1f x %.1f x %.1f mm, %.1f cm3, waterdicht %s, delen %d\n"
          % (best, e[0], e[1], e[2], t.volume / 1000, t.is_watertight, t.body_count))
    return t


print("helft A (bord):"); A = helft("A", -1, HELFT_A)
print("helft B (accu + sensor):"); B = helft("B", +1, HELFT_B)
