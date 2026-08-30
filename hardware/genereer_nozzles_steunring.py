#!/usr/bin/env python3
"""
Gardena-nozzle die RUST OP DE STEUNRING van de fles.

Het idee (van Dennis)
---------------------
Niet uitrichten op de flesrand of op een pen in de flesmond, maar op de
STEUNRING: die brede kraag onder de schroefdraad. Voordelen:

  - De ring is 33,07 mm in doorsnede tegen 21,74 mm voor de flesmond. Een
    bredere zitting verzet zich veel sterker tegen kantelen, want de hefboom
    is anderhalf keer zo groot.
  - De ring is spuitgegoten, dus vlak en haaks op de as.
  - Er is GEEN geleidingsbossing meer nodig. Precies die bossing maakte een
    diepe ringsleuf waar support in moest, en dat support was niet te
    verwijderen. Zonder bossing is het inwendige gewoon een boring met draad.

Rolverdeling, elk onderdeel doet een ding:
  positioneren  de rok landt op de steunring (hard en vlak)
  afdichten     O-ring op de flesrand (meegevend)
  vasthouden    de schroefdraad, die verder nergens tegenaan loopt

GEMETEN AAN DE FERNANDES-FLES
  steunring buitendiameter          33,07 mm
  flesrand tot bovenkant steunring  14,00 mm

PRINTEN
  Gardena-kant op het bed, rok naar boven open. De draad zit dan aan de
  binnenkant met de overhang naar beneden onder circa 50 graden, en dat print
  zonder support. Geen enkele holte waar je niet bij kunt.
  0,15 mm laagjes, PETG, olifantenpoot-compensatie aan.

CONTROLE
  Draai hem op de fles. Hij hoort te STOPPEN op de steunring, met een klein
  spleetje (0,3 mm) tussen dop en flesrand dat door de O-ring wordt gevuld.
  Zet daarna de fles op zijn kop op een vlakke tafel en draai hem rond: de
  nozzle hoort niet te wandelen.

Draaien:  ../../.venv/bin/python genereer_nozzles_steunring.py
"""
import numpy as np
import trimesh

# ---------------- Gardena-steel (opgemeten uit Raketfued Nozzle_8mm.stl) ------
STEEL = [
    (0.0, 15.1), (0.6, 15.5), (2.6, 15.5),
    (3.0, 11.8), (3.4, 11.4), (5.4, 11.4), (5.8, 11.8),   # O-ringgroef
    (6.2, 15.5), (7.8, 15.6),
    (8.2, 17.0), (10.6, 17.0),                            # greepkraag
    (11.0, 15.7), (11.4, 14.0), (11.8, 13.5), (15.4, 13.5),
    (16.2, 13.7), (17.0, 14.0), (17.8, 14.7), (18.6, 15.9),
    (19.4, 17.7), (20.2, 20.3), (22.6, 20.3),
]

# ---------------- flesmaten (gemeten) ----------------
RING_D      = 33.07   # buitendiameter steunring
RING_AFST   = 14.00   # flesrand tot bovenkant steunring
DRAAD_D     = 27.43   # buitendiameter schroefdraad
KERN_D      = 24.94   # kern tussen de draadgangen
RAND_BI     = 21.74   # binnenboring flesmond
SPOED       = 2.7
DRAAD_SPEL  = 0.45

# ---------------- dopmaten ----------------
DAK         = 4.0     # dikte boven de flesrand (hier zit de doorlaat in)
ROK_WAND    = 2.6
RAND_LUCHT  = 0.3     # spleet tussen dop en flesrand; de O-ring vult die
DRAAD_START = 2.2     # draad begint zover boven de flesrand
DRAAD_SLAG  = 9.0
ORING_D     = 2.0     # O-ringkoord 23 x 2 mm
GREEP_N     = 10
INTREDE_R   = 3.0
SEG         = 96

MATEN = [4.0, 5.0, 6.0, 7.0, 8.0, 9.0]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def draadhelix(r_bore, r_crest, hoogte, z0, spoed):
    """Binnendraad, punt voor punt opgebouwd zodat de draadrug naar binnen wijst."""
    r_bore = r_bore + 0.4
    kruin_h, flank_h = 0.45, 0.85
    prof = [(r_bore, -(kruin_h + flank_h)), (r_crest, -kruin_h),
            (r_crest, kruin_h), (r_bore, kruin_h + flank_h)]
    np_ = len(prof)
    stappen = max(int(hoogte / spoed * 90), 24)
    t = np.linspace(0.0, hoogte / spoed * 2 * np.pi, stappen)
    V, F = [], []
    for hoek in t:
        c, s_ = np.cos(hoek), np.sin(hoek)
        zc = z0 + hoek / (2 * np.pi) * spoed
        for (pr, pz) in prof:
            V.append((pr * c, pr * s_, zc + pz))
    for i in range(stappen - 1):
        for k in range(np_):
            a = i * np_ + k
            b = i * np_ + (k + 1) % np_
            c2 = (i + 1) * np_ + (k + 1) % np_
            d2 = (i + 1) * np_ + k
            F.append((a, b, c2)); F.append((a, c2, d2))
    for (idx, keer) in ((0, False), (stappen - 1, True)):
        basis = idx * np_
        for k in range(1, np_ - 1):
            tri = (basis, basis + k, basis + k + 1)
            F.append(tri[::-1] if keer else tri)
    m = trimesh.Trimesh(vertices=np.array(V), faces=np.array(F), process=True)
    trimesh.repair.fix_normals(m)
    return m


def bouw(d_gat):
    r_rok_bi = DRAAD_D / 2 + DRAAD_SPEL + 0.2      # vrij over de schroefdraad
    r_rok_bu = RING_D / 2 + ROK_WAND               # buitenkant van de rok
    r_kern   = KERN_D / 2 + DRAAD_SPEL

    z_st  = STEEL[-1][0]                # bovenkant Gardena-steel
    z_dak = z_st + DAK                  # dakvlak = tegenover de flesrand
    z_rnd = z_dak + RAND_LUCHT          # hier zit de flesrand (0,3 mm spleet)
    z_top = z_rnd + RING_AFST           # hier landt de rok op de steunring

    prof = [(d / 2, z) for z, d in STEEL]
    prof += [
        (r_rok_bu - 1.0, z_st + 0.8),   # schuine overgang naar de rok
        (r_rok_bu, z_st + 1.8),
        (r_rok_bu, z_top),              # buitenwand van de rok
        (r_rok_bi, z_top),              # ZITTING: dit vlak landt op de steunring
        (r_rok_bi, z_rnd),              # binnenwand van de rok
        (RAND_BI / 2 + 1.2, z_dak),     # dakvlak tegenover de flesrand
    ]
    delen = [omw(prof)]
    delen.append(draadhelix(r_rok_bi, r_kern, DRAAD_SLAG, z_rnd + DRAAD_START, SPOED))

    for i in range(GREEP_N):
        a = 2 * np.pi * i / GREEP_N
        rib = trimesh.creation.cylinder(radius=1.6, height=RING_AFST - 2, sections=16)
        rib.apply_translation((r_rok_bu, 0, z_rnd + RING_AFST / 2))
        rib.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        delen.append(rib)

    n = trimesh.boolean.union(delen, engine='manifold')

    # doorlaat met afgeronde intrede aan de waterkant
    r = d_gat / 2
    p = []
    for i in range(21):
        hoek = (i / 20) * np.pi / 2
        p.append((r + INTREDE_R * np.cos(hoek),
                  z_dak + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, -1.0)] + p[::-1] + [(r + INTREDE_R, z_dak + 1.0)]

    # O-ringgroef in het dakvlak, precies tegenover de flesrand (21,74 - 27,43)
    r_mid = (RAND_BI + DRAAD_D) / 4
    gh = ORING_D * 0.55
    bu = trimesh.creation.cylinder(radius=r_mid + ORING_D / 2, height=gh, sections=SEG)
    bi = trimesh.creation.cylinder(radius=r_mid - ORING_D / 2, height=gh + 2, sections=SEG)
    bu.apply_translation((0, 0, z_dak - gh / 2))
    bi.apply_translation((0, 0, z_dak - gh / 2))
    groef = trimesh.boolean.difference([bu, bi], engine='manifold')

    n = trimesh.boolean.difference([n, omw(kanaal), groef], engine='manifold')
    n.merge_vertices()
    n.update_faces(n.nondegenerate_faces())
    n.update_faces(n.unique_faces())
    n.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(n)

    naam = 'PWS_Waterraket_NozzleSteunring_%02dmm.stl' % round(d_gat)
    n.export(naam)
    t = trimesh.load(naam)
    e = t.bounding_box.extents
    print("%-44s gat %4.1f   %.1f x %.1f x %.1f mm   waterdicht: %s"
          % (naam, d_gat, e[0], e[1], e[2], t.is_watertight))
    return t


print("zitting op de steunring (%.2f mm), %.2f mm boven de flesrand\n"
      % (RING_D, RING_AFST))
for d in MATEN:
    bouw(d)
