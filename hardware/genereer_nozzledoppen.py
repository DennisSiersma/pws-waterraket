#!/usr/bin/env python3
"""
Volledig geprinte nozzle-doppen met PCO1881-schroefdraad.

Dit is de variant ZONDER originele dop: draad, afdichting en doorlaat in een deel.
Zie genereer_nozzles.py voor de variant met een geboorde originele dop.

MAATREGELEN TEGEN SCHEEFSTAAN
De klacht bij geprinte doppen is dat ze scheef op de fles komen. Drie dingen in
dit ontwerp gaan daartegenin:

1. GELEIDINGSBOSSING. Binnenin steekt een cilinder van 12 mm in de flesmond
   (binnendiameter 21,74 mm). Die lange geleiding dwingt de dop recht, los van
   de draad. Dit is de belangrijkste maatregel.
2. VLAKKE ZITTING. De dop rust met een vlak ringvormig vlak op de bovenrand van
   de fles. Daar zit ook de O-ringgroef. De draad trekt alleen aan; de vlakke
   rand bepaalt de stand.
3. DRAADVRIJLOOP. Boven de draad is ruimte, zodat de dop nooit op de draad kan
   bottomen voordat hij op de flesrand zit.

DRAADGEGEVENS (ISBT PCO 1881, 28 mm hals)
   spoed 2,7 mm, een draadgang (single start)
   draad buitendiameter fles  27,43 mm
   draadkern fles             24,94 mm
   binnenboring hals          21,74 mm
De flanken zijn beperkt tot circa 50 graden, zodat er bij het printen geen
steile overhang ontstaat.

PRINTEN
   Met de DICHTE KANT OP HET BED, opening naar boven. De draad zit dan aan de
   binnenkant en print als een flauwe overhang. Geen supports.
   0,15 mm laagjes, 3 wanden, 100% infill in de bovenkant.
   Zet olifantenpoot-compensatie aan.

PASSEN
   Print eerst een dop en probeer hem. Te strak: verhoog DRAAD_SPEL met 0,1.
   Te los: verlaag met 0,1. Verander de spoed NIET.

Draaien:  ../../.venv/bin/python genereer_nozzledoppen.py
"""
import numpy as np
import trimesh

# ---------------- halsmaten PCO1881 (mm) ----------------
DRAAD_D     = 27.43   # buitendiameter draad op de fles
KERN_D      = 24.94   # kern tussen de draadgangen
HALS_D      = 21.74   # binnenboring van de flesmond
SPOED       = 2.7     # afstand per omwenteling
DRAAD_SPEL  = 0.45    # speling: hier draaien aan als het te strak/los zit

# ---------------- dopmaten ----------------
WAND        = 3.0     # wanddikte van de dop
DAK         = 4.0     # dikte van de bovenkant (waar de doorlaat in zit)
DOP_H       = 15.0    # totale hoogte
DRAAD_START = 3.0     # draad begint zover boven de bodem van de dop
DRAAD_SLAG  = 9.0     # hoogte waarover de draad loopt
GELEIDING_H = 12.0    # lengte van de geleidingsbossing in de hals
GELEIDING_SPEL = 0.5
ORING_D     = 2.0     # dikte van het O-ringkoord (23 x 2 mm past goed)
GREEP_N     = 12      # aantal greepribbels op de buitenkant
INTREDE_R   = 3.0
SEG         = 96

MATEN = [4.0, 6.0, 8.0, 10.0]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def draadhelix(r_bore, r_crest, hoogte, z0, spoed):
    """Binnendraad, punt voor punt opgebouwd.

    Het profiel ligt in het radiaal-z-vlak en wordt langs een schroeflijn
    gedraaid. Zelf opbouwen in plaats van sweep_polygon gebruiken: die bepaalt
    zelf hoe het profiel om de baan draait, en dan wijst de draadrug de
    verkeerde kant op.
    """
    # de buitenkant steekt 0,4 mm IN de wand: samenvallende vlakken geven
    # anders een onbetrouwbare samenvoeging
    r_bore = r_bore + 0.4
    kruin_h, flank_h = 0.45, 0.85
    prof = [
        (r_bore,  -(kruin_h + flank_h)),
        (r_crest, -kruin_h),
        (r_crest,  kruin_h),
        (r_bore,   kruin_h + flank_h),
    ]
    np_ = len(prof)
    omw_n = hoogte / spoed
    stappen = max(int(omw_n * 90), 24)
    t = np.linspace(0.0, omw_n * 2 * np.pi, stappen)

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
            F.append((a, b, c2))
            F.append((a, c2, d2))
    for (idx, keer) in ((0, False), (stappen - 1, True)):
        basis = idx * np_
        for k in range(1, np_ - 1):
            tri = (basis, basis + k, basis + k + 1)
            F.append(tri[::-1] if keer else tri)

    m = trimesh.Trimesh(vertices=np.array(V), faces=np.array(F), process=True)
    trimesh.repair.fix_normals(m)
    return m


def bouw(d_gat):
    r_buiten = DRAAD_D / 2 + DRAAD_SPEL + WAND
    r_boring = DRAAD_D / 2 + DRAAD_SPEL          # vrije boring over de flesdraad
    r_kern = KERN_D / 2 + DRAAD_SPEL             # waar de draadrug tot komt
    r_gel = HALS_D / 2 - GELEIDING_SPEL / 2      # geleidingsbossing

    body = omw([
        (r_buiten, 0.0), (r_buiten, DOP_H),
        (r_boring, DOP_H), (r_boring, DAK),
        (r_gel, DAK),                            # zitting op de flesrand
        (r_gel, DAK + GELEIDING_H),
    ])
    delen = [body, draadhelix(r_boring, r_kern, DRAAD_SLAG, DRAAD_START, SPOED)]

    for i in range(GREEP_N):                     # greepribbels buitenom
        a = 2 * np.pi * i / GREEP_N
        rib = trimesh.creation.cylinder(radius=1.5, height=DOP_H, sections=16)
        rib.apply_translation((r_buiten, 0, DOP_H / 2))
        rib.apply_transform(trimesh.transformations.rotation_matrix(a, [0, 0, 1]))
        delen.append(rib)

    dop = trimesh.boolean.union(delen, engine='manifold')

    # doorlaat met afgeronde intrede
    r = d_gat / 2
    z_top = DAK + GELEIDING_H
    prof = []
    m = 20
    for i in range(m + 1):
        hoek = (i / m) * np.pi / 2
        prof.append((r + INTREDE_R * np.cos(hoek),
                     z_top + 0.5 - INTREDE_R * (1 - np.sin(hoek))))
    kanaal = [(r, -1.0)] + prof[::-1] + [(r + INTREDE_R, z_top + 1.0)]

    # O-ringgroef als echte ring bouwen, niet via een omwenteling met
    # asafsluiting: dat laatste geeft een dubbel doorlopen lijnstuk op de as
    # en daarmee een lek model
    r_mid = (r_gel + r_boring) / 2
    gh = ORING_D * 0.55
    buit = trimesh.creation.cylinder(radius=r_mid + ORING_D / 2, height=gh, sections=SEG)
    binn = trimesh.creation.cylinder(radius=r_mid - ORING_D / 2, height=gh + 2, sections=SEG)
    buit.apply_translation((0, 0, DAK - gh / 2))
    binn.apply_translation((0, 0, DAK - gh / 2))
    groef = trimesh.boolean.difference([buit, binn], engine='manifold')

    dop = trimesh.boolean.difference([dop, omw(kanaal), groef], engine='manifold')

    dop.merge_vertices()
    dop.update_faces(dop.nondegenerate_faces())
    dop.update_faces(dop.unique_faces())
    dop.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(dop)

    naam = 'PWS_Waterraket_Nozzledop_%02dmm.stl' % round(d_gat)
    dop.export(naam)
    terug = trimesh.load(naam)
    e = terug.bounding_box.extents
    print("%-36s gat %4.1f   %.1f x %.1f x %.1f mm   waterdicht: %s  delen: %d"
          % (naam, d_gat, e[0], e[1], e[2], terug.is_watertight, terug.body_count))
    return terug


print("PCO1881: spoed %.1f mm, draad %.2f/%.2f mm, hals %.2f mm, speling %.2f\n"
      % (SPOED, DRAAD_D, KERN_D, HALS_D, DRAAD_SPEL))
for d in MATEN:
    bouw(d)
