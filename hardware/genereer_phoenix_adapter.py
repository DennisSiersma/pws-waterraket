#!/usr/bin/env python3
"""
Adapter tussen de Fernandes-fles (88,5 mm) en het Raketfued Phoenix 3D d78m
recovery-systeem.

Drie functies in een deel:
  - onderaan: schuifrand over de cilindrische fles
  - binnenin: elektronicaruimte met rails voor de payloadhouder + statische poorten
  - bovenop: koepelvormige spigot die de bovenkant van een 1L-fles nabootst,
    zodat de Phoenix-behuizing er ONGEWIJZIGD op gelijmd wordt

Het spigotprofiel is opgemeten uit Phoenix3D_d78m_Casing_tommytimer.stl
(binnendiameter per hoogte) en met 0,6 mm speling verkleind.

Draaien:  ../../.venv/bin/python genereer_phoenix_adapter.py
Print staand, zonder supports.
"""
import numpy as np, trimesh

FLES_D    = 88.5    # Fernandes Cherry Bouquet 1,5 L
FLES_SPEL = 1.0
WAND      = 1.6
SKIRT_H   = 32.0
VLOER     = 2.4
BAY_H     = 92.0    # elektronicaruimte
TAPS_H    = 25.0    # bovenste deel loopt taps toe naar de Phoenix-diameter
PLAAT     = 2.4     # topplaat waar de casing-rand op rust
PHOENIX_OD = 81.0

HOUDER_B, HOUDER_T, RAIL_SPEL = 71.4, 12.0, 0.8
POORT_D, POORT_N, POORT_H = 3.0, 4, 55.0
KOORD_D = 4.0
SEG = 96

# gemeten holteprofiel van de casing-onderkant: (hoogte, binnendiameter)
KOEPEL = [(0.5,80.3),(2.0,78.3),(3.5,77.0),(5.0,74.0),(6.5,73.0),(8.0,73.0),
          (9.5,73.0),(11.0,73.0),(12.5,73.0),(14.0,60.0),(15.5,60.0),
          (17.0,49.8),(18.5,41.0),(20.0,34.1),(21.5,28.2),(23.0,23.1),
          (24.5,18.6),(26.0,14.5),(27.5,10.8)]
SPIGOT_SPEL = 0.6   # radiale speling: diameter wordt 2x0,3 kleiner... nee: totaal

ID = FLES_D + FLES_SPEL
OD = ID + 2 * WAND
z_vloer = SKIRT_H
z_bay   = SKIRT_H + VLOER
z_taps  = z_bay + BAY_H - TAPS_H
z_plaat = z_bay + BAY_H
z_top   = z_plaat + PLAAT

def omwenteling(punten):
    """Gesloten omwentelingslichaam uit (r, z)-punten; sluit zelf op de as."""
    pts = [[0.0, punten[0][1]]] + [[r, z] for r, z in punten] + [[0.0, punten[-1][1]]]
    return trimesh.creation.revolve(np.array(pts), sections=SEG)

def balk(sx, sy, sz, x, y, z):
    m = trimesh.creation.box(extents=(sx, sy, sz))
    m.apply_translation((x + sx/2, y + sy/2, z + sz/2))
    return m

def cil(d, h, z0, as_='z', sec=48):
    m = trimesh.creation.cylinder(radius=d/2, height=h, sections=sec)
    if as_ == 'x':
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
    elif as_ == 'y':
        m.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [1,0,0]))
    m.apply_translation((0,0,z0) if as_=='z' else (0,0,z0))
    return m

# ---- buitenvorm: cilinder die bovenaan taps toeloopt naar de Phoenix-maat ----
buiten = omwenteling([
    (OD/2, 0), (OD/2, z_taps),
    (PHOENIX_OD/2, z_plaat), (PHOENIX_OD/2, z_top),
])
# ---- holtes ----
skirt_holte = omwenteling([(ID/2, -1), (ID/2, z_vloer)])
bay_binnen = [
    (ID/2, z_bay), (ID/2, z_taps),
    (PHOENIX_OD/2 - WAND, z_plaat),
]
bay_holte = omwenteling(bay_binnen)
romp = trimesh.boolean.difference([buiten, skirt_holte, bay_holte], engine='manifold')

# ---- rails en dwarssteun voor de houder (rechtop) ----
delen = [romp]
rail_b, rail_d = 3.0, 9.0
rail_h = BAY_H - TAPS_H - 4        # rails alleen in het rechte deel
gleuf = HOUDER_T + RAIL_SPEL
for kant in (-1, 1):
    x = kant * (gleuf/2 + rail_b/2)
    for y in (-HOUDER_B*0.42, HOUDER_B*0.42 - rail_d):
        delen.append(balk(rail_b, rail_d, rail_h, x - rail_b/2, y, z_bay))
delen.append(balk(gleuf + 2*rail_b, 3.0, 6.0, -(gleuf + 2*rail_b)/2, -1.5, z_bay))

# ---- spigot: nagebootste 1L-flestop, met speling ----
spig_pts = [(max(d - SPIGOT_SPEL, 2.0)/2, z_top + z) for z, d in KOEPEL]
spig_pts = [(spig_pts[0][0], z_top - 0.5)] + spig_pts     # verzonken start
delen.append(omwenteling(spig_pts))

m = trimesh.boolean.union(delen, engine='manifold')

# ---- gaten ----
gaten = []
for i in range(POORT_N):
    a = 2*np.pi*i/POORT_N
    g = trimesh.creation.cylinder(radius=POORT_D/2, height=OD+4, sections=32)
    g.apply_transform(trimesh.transformations.rotation_matrix(np.pi/2, [0,1,0]))
    g.apply_transform(trimesh.transformations.rotation_matrix(a, [0,0,1]))
    g.apply_translation((0, 0, z_bay + POORT_H))
    gaten.append(g)
for kant in (-1, 1):
    g = trimesh.creation.cylinder(radius=KOORD_D/2, height=VLOER+4, sections=24)
    g.apply_translation((kant*(ID/2 - 8), 0, z_vloer + VLOER/2))
    gaten.append(g)
m = trimesh.boolean.difference([m] + gaten, engine='manifold')
m.export('PWS_Waterraket_Phoenix_Adapter.stl')

e = m.bounding_box.extents
print("waterdicht: %s | driehoeken: %d" % (m.is_watertight, len(m.faces)))
print("afmetingen: %.1f x %.1f x %.1f mm" % tuple(e))
print("volume: %.1f cm3 (~%.0f g PLA)" % (m.volume/1000, m.volume/1000*1.24*0.45))
print("spigot-top op z=%.1f, totale hoogte %.1f" % (z_top, e[2]))
