// =====================================================================
//  Waterraket payload-houder
//  ESP32-S3-Touch-LCD-1.69  +  BMP388 (CJMCU-388)  +  LiPo 902025
//  Parametrisch - meet je onderdelen met een schuifmaat en pas aan.
//  Print: bodem op het bed, GEEN supports nodig.
// =====================================================================

/* [ Board: ESP32-S3-Touch-LCD-1.69 ] */
board_w    = 38;    // breedte PCB  (PWR-zijde <-> USB-C-zijde)  -- METEN
board_l    = 38;    // lengte PCB                                 -- METEN
board_t    = 1.6;   // dikte PCB
back_clear = 6.5;   // vrije ruimte ONDER de PCB (USB-C-connector/chips)
clip_grip  = 1.4;   // hoeveel de hoekclip over de PCB-rand pakt
clip_h     = 1.6;   // hoogte cliphaak boven de PCB

/* [ Accu: LiPo 902025 (3,7V 500mAh) ] */
batt_w     = 20;    // -- METEN
batt_l     = 25;    // -- METEN
batt_t     = 9;     // -- METEN
batt_play  = 0.8;   // speling rond de accu

/* [ Barometer: BMP388 / CJMCU-388 ] */
bmp_w      = 11.5;  // -- METEN
bmp_l      = 15.5;  // -- METEN
bmp_t      = 4.5;   // -- METEN (incl. componenten)
bmp_play   = 0.6;
vent_d     = 3.5;   // ventilatiegat barometer (statische poort)

/* [ Algemeen ] */
wall       = 2.0;   // wanddikte
base       = 2.0;   // bodemdikte
post       = 5.0;   // footprint hoeksteun
ledge      = 2.6;   // hoe ver de steun onder de PCB-hoek pakt
led_t      = 1.6;   // dikte steunrichel
margin     = 5.0;   // marge aan de uiteinden (>= post, anders steekt de steun uit)
gap        = 5.0;   // ruimte tussen board-zone en accublok
pocket_gap = 2.0;   // ruimte tussen accu- en BMP-vak
mounts     = true;  // zijoren met M3-gat + tiewrap-sleuf
screw_d    = 3.4;   // M3 doorvoer
strap_w    = 12;    // breedte spanband-sleuven
eps        = 0.01;
$fn        = 48;

// ---------- afgeleide maten ----------
batt_pw = batt_w + 2*batt_play + 2*wall;   // accuvak buitenmaat (x)
batt_pl = batt_l + 2*batt_play + 2*wall;   // accuvak buitenmaat (y)
bmp_pw  = bmp_w  + 2*bmp_play  + 2*wall;
bmp_pl  = bmp_l  + 2*bmp_play  + 2*wall;

board_zone_w = board_w + 2*post;
pockets_w    = batt_pw + pocket_gap + bmp_pw;
plate_w  = max(board_zone_w, pockets_w);
pockets_l = max(batt_pl, bmp_pl);
plate_l  = margin + pockets_l + gap + board_l + margin;

H_top = back_clear + board_t + clip_h;     // hoogte hoeksteun vanaf bodem-bovenkant

// board-hoeken
bx0 = (plate_w - board_w)/2;
bx1 = bx0 + board_w;
by0 = plate_l - margin - board_l;
by1 = by0 + board_l;

// pockets-cluster (gecentreerd in x)
clx0 = (plate_w - pockets_w)/2;
batt_x0 = clx0;
bmp_x0  = clx0 + batt_pw + pocket_gap;
pock_y0 = margin;

// =====================================================================
module corner_clip() {
  // lokaal: board-hoek op (0,0); board-interieur = +x,+y; kolom in -x,-y
  ov = 1.2;
  union() {
    // kolom
    translate([-post, -post, 0]) cube([post, post, base + H_top]);
    // steunrichel onder de PCB-hoek
    translate([-ov, -ov, base + back_clear - led_t])
      cube([ledge + ov, ledge + ov, led_t]);
    // cliphaak (wig: vlakke houdkant onder, schuine inloop boven)
    zb = base + back_clear + board_t;
    hull() {
      translate([-ov, -ov, zb])            cube([clip_grip + ov, post, eps]);
      translate([-ov, -ov, zb + clip_h])   cube([ov + eps,       post, eps]);
    }
  }
}

module pocket(px, py, pw, pl, ph, wire_to_y_plus=true, vent=false) {
  difference() {
    translate([px, py, 0]) cube([pw, pl, base + ph]);
    // holte (open bovenkant)
    translate([px + wall, py + wall, base])
      cube([pw - 2*wall, pl - 2*wall, ph + eps]);
    // draadsleuf in de wand richting board (+y)
    if (wire_to_y_plus)
      translate([px + pw/2 - 2.5, py + pl - wall - eps, base + ph - 3])
        cube([5, wall + 2*eps, 3 + eps]);
    // ventilatiegat (statische poort) in de -y wand
    if (vent)
      translate([px + pw/2, py - eps, base + ph/2])
        rotate([-90,0,0]) cylinder(h = wall + 2*eps, d = vent_d);
  }
}

module mount_ear(side) {  // side = -1 (links) of +1 (rechts)
  ew = 10; et = base + 1.5; el = 16;
  x = (side < 0) ? -ew + eps : plate_w - eps;
  translate([x, plate_l/2 - el/2, 0])
  difference() {
    cube([ew, el, et]);
    translate([ew/2, el*0.30, -eps]) cylinder(h = et + 2*eps, d = screw_d);
    // tiewrap-sleuf
    translate([ew/2 - 2, el*0.62, -eps]) cube([4, 6, et + 2*eps]);
  }
}

// =====================================================================
difference() {
  union() {
    // bodemplaat
    cube([plate_w, plate_l, base]);

    // vier hoekclips voor het board
    translate([bx0, by0, 0])                       corner_clip();
    translate([bx1, by0, 0]) mirror([1,0,0])       corner_clip();
    translate([bx0, by1, 0]) mirror([0,1,0])       corner_clip();
    translate([bx1, by1, 0]) mirror([1,0,0]) mirror([0,1,0]) corner_clip();

    // accuvak + BMP-vak
    pocket(batt_x0, pock_y0, batt_pw, batt_pl, batt_t, true,  false);
    pocket(bmp_x0,  pock_y0, bmp_pw,  bmp_pl,  bmp_t,  true,  true);

    if (mounts) { mount_ear(-1); mount_ear(1); }
  }

  // spanband-sleuven door de bodem, weerszijden van het accuvak
  translate([clx0 + pockets_w/2 - strap_w/2, pock_y0 - 1.5 - 0.0, -eps])
    cube([strap_w, 2.5, base + 2*eps]);
  translate([clx0 + pockets_w/2 - strap_w/2, pock_y0 + pockets_l - 1.0, -eps])
    cube([strap_w, 2.5, base + 2*eps]);

  // gewicht besparen: gat in de bodem onder het board (open cavity)
  translate([bx0 + 5, by0 + 5, -eps])
    cube([board_w - 10, board_l - 10, base + 2*eps]);
}
