#!/usr/bin/env python3
"""
Verwisselbare neuzen die IN de recovery-romp geschroefd worden.

Drie vormen, zodat neusvorm een onderzoeksvariabele kan worden:

  ogief        klassiek raketprofiel, gaat rakend over in de romp
  kegel        rechte kegel, eenvoudigst en zwaarste weerstand
  elliptisch   stomper, kortere en vollere neus

Alle drie hebben dezelfde grove schroefdraad (spoed 5 mm, drie gangen) en een
kraag die op de rand van de romp landt. Een kwartslag is genoeg om ze te
wisselen, dus je kunt op het veld tussen vormen wisselen.

Waarom een grove meergangs draad: fijne geprinte draad is gevoelig voor
laaglijnen en loopt snel vast. Drie gangen met 5 mm spoed pakken meteen en
lopen soepel, ook als de print niet perfect is.

Printen: staand met de punt omhoog, geen supports. De draad zit onderaan en
print als een flauwe overhang. PETG, 0,2 mm laagjes, 3 wanden.

Draaien:  ../../.venv/bin/python genereer_neuzen.py
"""
import numpy as np
import trimesh

# ---------------- moet overeenkomen met genereer_recovery.py ----------------
FLES_D, FLES_SPEL, WAND = 88.5, 1.0, 1.6
NEUS_SPOED, NEUS_GANGEN, NEUS_SLAG, NEUS_DIEPTE = 5.0, 3, 12.0, 2.2
NEUS_SPEL = 0.7      # geprinte draad op deze maat heeft dit echt nodig

ID = FLES_D + FLES_SPEL          # boring van de romp
OD = ID + 2 * WAND
R_IN = ID / 2

KRAAG_H = 3.0                    # kraag die op de romprand landt
DRAAD_START = 2.0                # begint zover boven de kraag
WAND_NEUS = 1.6                  # zelfde als de oude punt; 2,0 was onnodig zwaar
SEG = 96

# (naam, hoogte, vorm)
VORMEN = [
    ("Ogief",       80.0, "ogief"),
    ("Kegel",       80.0, "kegel"),
    ("Elliptisch",  60.0, "ellips"),
]


def omw(punten, sec=SEG):
    pts = ([[0.0, punten[0][1]]]
           + [[float(r), float(z)] for r, z in punten]
           + [[0.0, punten[-1][1]]])
    return trimesh.creation.revolve(np.array(pts), sections=sec)


def draadgang(r_kern, r_kruin, hoogte, z0, spoed, gangen):
    """Buitendraad: de rug steekt naar BUITEN, van r_kern naar r_kruin."""
    kruin, flank = spoed * 0.14, spoed * 0.26
    prof = [(r_kern - 0.4, -(kruin + flank)), (r_kruin, -kruin),
            (r_kruin, kruin), (r_kern - 0.4, kruin + flank)]
    n_ = len(prof)
    stukken = []
    for g in range(gangen):
        start = 2 * np.pi * g / gangen
        omwn = hoogte / (spoed * gangen)
        stappen = max(int(omwn * 160), 40)
        t = np.linspace(0.0, omwn * 2 * np.pi, stappen)
        V, F = [], []
        for hoek in t:
            c, sn = np.cos(hoek + start), np.sin(hoek + start)
            zc = z0 + hoek / (2 * np.pi) * spoed * gangen
            for (pr, pz) in prof:
                V.append((pr * c, pr * sn, zc + pz))
        for i in range(stappen - 1):
            for k in range(n_):
                a_ = i * n_ + k; b_ = i * n_ + (k + 1) % n_
                c_ = (i + 1) * n_ + (k + 1) % n_; d_ = (i + 1) * n_ + k
                F.append((a_, b_, c_)); F.append((a_, c_, d_))
        for (idx, keer) in ((0, False), (stappen - 1, True)):
            bs = idx * n_
            for k in range(1, n_ - 1):
                tri = (bs, bs + k, bs + k + 1)
                F.append(tri[::-1] if keer else tri)
        m_ = trimesh.Trimesh(vertices=np.array(V), faces=np.array(F), process=True)
        trimesh.repair.fix_normals(m_)
        stukken.append(m_)
    return stukken


def straal(vorm, x, r0, L):
    """x loopt van 0 (basis) tot 1 (punt); geeft de straal."""
    if vorm == "kegel":
        return r0 * (1 - x)
    if vorm == "ellips":
        return r0 * np.sqrt(max(0.0, 1 - x ** 2))
    # tangent-ogief: cirkelboog die rakend in de romp overgaat en in een punt
    # eindigt. Het oude profiel was bij de top bijna vlak (op 1 mm onder de
    # punt nog 11 mm straal), waardoor de holte een plat plafond kreeg dat
    # alleen met support te printen was.
    rho = (r0 ** 2 + L ** 2) / (2 * r0)
    z = x * L
    return max(0.0, np.sqrt(max(0.0, rho ** 2 - z ** 2)) + r0 - rho)


def bouw(naam, hoogte, vorm):
    r_kern = R_IN - NEUS_DIEPTE + NEUS_SPEL      # kern van de draad
    r_kruin = R_IN - NEUS_SPEL                   # rug van de draad
    r_kraag = OD / 2

    # Volgorde van ONDER naar BOVEN: eerst het draaddeel (dat gaat de romp in),
    # dan de kraag die op de romprand landt, dan pas de neusvorm.
    z_dr = 1.0                                   # draad van 1 tot 13 mm
    z_kraag0 = z_dr + NEUS_SLAG + 1.0            # 14
    z_body = z_kraag0 + KRAAG_H                  # 17: hier begint de vorm

    prof = [(r_kern, 0.0), (r_kern, z_kraag0),
            (r_kraag, z_kraag0), (r_kraag, z_body)]
    n = 120
    TOP_R = 2.5                                  # afgeplatte top: geen naald
    for i in range(n + 1):
        x = i / n
        r = straal(vorm, x, r_kraag, hoogte)
        if r < TOP_R:
            prof.append((TOP_R, z_body + x * hoogte))
            break
        prof.append((r, z_body + x * hoogte))
    body = omw(prof)

    delen = [body] + draadgang(r_kern, r_kruin, NEUS_SLAG, z_dr,
                               NEUS_SPOED, NEUS_GANGEN)
    neus = trimesh.boolean.union(delen, engine='manifold')

    # uithollen: scheelt gewicht en printtijd
    # Holte. Eisen: (a) wand overal >= WAND_NEUS, (b) het plafond nergens
    # vlakker dan 45 graden (anders support in een gesloten holte), (c) de top
    # massief over minstens WAND_NEUS. De holte volgt de buitenvorm en sluit
    # met een 45-gradenkegel; het startpunt van die kegel is het HOOGSTE punt
    # waar aan alle drie de eisen voldaan is. Dat wordt per vorm uitgerekend.
    def r_uit(z):
        return straal(vorm, (z - z_body) / hoogte, r_kraag, hoogte)
    z_e = prof[-1][1]                            # hoogte van de afgeplatte top
    W = WAND_NEUS
    stap = 0.5
    HELLING = 1.3        # radiale krimp per mm hoogte: tan(52 gr). Printers halen dit.
    BRUG = 4.0           # een vlakke sluiting tot 8 mm doorsnede overbrugt elke printer

    def kegel_ok(zc):
        rc = r_uit(zc) - W
        if rc < 1.0:
            return False
        h = 0.0
        while rc - h * HELLING > BRUG:
            if zc + h > z_e - W:                 # komt door de top
                return False
            if r_uit(zc + h) - (rc - h * HELLING) < W:   # komt door de wand
                return False
            h += stap
        return zc + h <= z_e - W

    zc = z_e - W
    while zc > z_body + 5.0 and not kegel_ok(zc):
        zc -= stap

    binnen = [(r_kern - W, -1.0), (r_kern - W, z_body)]
    z = z_body + stap
    r_prev = r_kern - W
    while z < zc:
        r_w = r_uit(z) - W
        r_w = min(r_w, r_prev + stap)            # wijder mag, maar hoogstens 45 gr
        if r_prev - r_w > stap * HELLING:        # smaller: nooit vlakker dan 52 gr
            r_w = r_prev - stap * HELLING
        binnen.append((r_w, z)); r_prev = r_w
        z += stap
    rc = min(r_uit(zc) - W, r_prev)
    h = 0.0
    while rc - h * HELLING > BRUG:
        binnen.append((rc - h * HELLING, zc + h)); h += stap
    binnen.append((max(rc - h * HELLING, 0.6), zc + h))   # kleine vlakke brug
    massief_top = z_e - (zc + h)
    neus = trimesh.boolean.difference([neus, omw(binnen)], engine='manifold')

    neus.merge_vertices(); neus.update_faces(neus.nondegenerate_faces())
    neus.update_faces(neus.unique_faces()); neus.remove_unreferenced_vertices()
    trimesh.repair.fill_holes(neus); trimesh.repair.fix_normals(neus)

    best = 'PWS_Waterraket_Neus_%s.stl' % naam
    neus.export(best)
    t = trimesh.load(best)
    e = t.bounding_box.extents
    print("%-34s %5.1f x %5.1f x %5.1f mm  %5.1f cm3 (~%2.0f g)  massieve top %.1f mm  waterdicht: %s"
          % (best, e[0], e[1], e[2], t.volume / 1000,
             t.volume / 1000 * 1.27 * 0.4, massief_top, t.is_watertight))
    return t


print("draad: spoed %.1f mm, %d gangen, kern %.1f / rug %.1f mm\n"
      % (NEUS_SPOED, NEUS_GANGEN, (R_IN - NEUS_DIEPTE + NEUS_SPEL) * 2,
         (R_IN - NEUS_SPEL) * 2))
for naam, h, v in VORMEN:
    bouw(naam, h, v)
