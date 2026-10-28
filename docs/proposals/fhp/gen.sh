#!/system/bin/sh
# Generates 6 mock-up SVGs for the FHP lattice-gas visualiser options.
cd "$(dirname "$0")"
W=960; H=540
hdr='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540"><defs><filter id="g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="G" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter></defs><rect width="960" height="540" fill="#05060c"/>'

# F1 Particle rain: hex lattice, particles coloured by direction, collision sparks
awk -v hdr="$hdr" 'BEGIN{srand(11);print hdr;
 split("#22e6ff #ff3fd2 #ffe14a #ff8a2a #3dff8a #4d7cff",C," ");
 s=14; print "<g opacity=\"0.18\" stroke=\"#3a4a7a\" stroke-width=\"0.6\">";
 for(r=0;r<44;r++)for(c=0;c<72;c++){x=c*s+(r%2)*s/2;y=r*s*0.866; if(rand()<0.35)printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"0.9\" fill=\"#3a4a7a\"/>",x,y}
 print "</g><g filter=\"url(#g)\">";
 for(i=0;i<1400;i++){r=int(rand()*44);c=int(rand()*72);x=c*s+(r%2)*s/2;y=r*s*0.866;d=int(rand()*6);a=d*3.14159/3;
  printf "<line x1=\"%.1f\" y1=\"%.1f\" x2=\"%.1f\" y2=\"%.1f\" stroke=\"%s\" stroke-width=\"1.6\" stroke-linecap=\"round\" opacity=\"0.85\"/>",x,y,x-cos(a)*9,y-sin(a)*9,C[d+1]}
 for(i=0;i<70;i++){x=rand()*960;y=rand()*540;printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"%.1f\" fill=\"#fff\"/>",x,y,1.5+rand()*2.5}
 print "</g></svg>"}' > f1-particle-rain.svg

# F2 Zoom to fluid: noisy particles on the left blend into smooth streamlines on the right
awk -v hdr="$hdr" 'BEGIN{srand(22);print hdr;
 print "<defs><linearGradient id=\"m\" x1=\"0\" x2=\"1\"><stop offset=\"0.3\" stop-color=\"#fff\" stop-opacity=\"1\"/><stop offset=\"0.6\" stop-color=\"#fff\" stop-opacity=\"0\"/></linearGradient><mask id=\"k\"><rect width=\"960\" height=\"540\" fill=\"url(#m)\"/></mask><linearGradient id=\"m2\" x1=\"0\" x2=\"1\"><stop offset=\"0.35\" stop-color=\"#fff\" stop-opacity=\"0\"/><stop offset=\"0.65\" stop-color=\"#fff\" stop-opacity=\"1\"/></linearGradient><mask id=\"k2\"><rect width=\"960\" height=\"540\" fill=\"url(#m2)\"/></mask></defs>";
 print "<g mask=\"url(#k)\" filter=\"url(#g)\">"; for(i=0;i<2600;i++){x=rand()*640;y=rand()*540;h=int(rand()*6);split("#22e6ff #ff3fd2 #ffe14a #ff8a2a #3dff8a #4d7cff",C," ");printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"1.3\" fill=\"%s\"/>",x,y,C[h+1]} print "</g>";
 print "<g mask=\"url(#k2)\" fill=\"none\" filter=\"url(#g)\">";
 for(j=0;j<46;j++){y0=j*12+6; printf "<path d=\"M%d %.1f",300,y0; for(x=300;x<=960;x+=12){y=y0+28*sin(x/70+j*0.35)*cos(y0/90);printf " L%d %.1f",x,y} hue=(j*7)%360; printf "\" stroke=\"hsl(%d,90%%,62%%)\" stroke-width=\"1.4\" opacity=\"0.8\"/>",190+(j*3)%120}
 print "</g></svg>"}' > f2-zoom-to-fluid.svg

# F3 Vortex street: obstacle on the left, alternating vortices downstream
awk -v hdr="$hdr" 'BEGIN{srand(33);print hdr;
 print "<g filter=\"url(#g)\" fill=\"none\">";
 for(j=0;j<40;j++){y=j*13.5+4;printf "<path d=\"M0 %.1f L160 %.1f\" stroke=\"#2b3c66\" stroke-width=\"1\"/>",y,y}
 for(v=0;v<6;v++){cx=260+v*120;cy=(v%2)?320:220;col=(v%2)?"#ff3fd2":"#22e6ff";sgn=(v%2)?1:-1;
  printf "<path d=\"M%.1f %.1f",cx,cy; for(t=0;t<18;t+=0.15){r=3+t*2.6;printf " L%.1f %.1f",cx+r*cos(sgn*t),cy+r*sin(sgn*t)} printf "\" stroke=\"%s\" stroke-width=\"2\" opacity=\"0.9\"/>",col}
 print "</g><circle cx=\"175\" cy=\"270\" r=\"38\" fill=\"#0b0f1c\" stroke=\"#ffe14a\" stroke-width=\"3\" filter=\"url(#g)\"/>";
 for(i=0;i<900;i++){x=200+rand()*760;y=170+rand()*200;printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"0.8\" fill=\"#8aa0ff\" opacity=\"0.35\"/>",x,y}
 print "</svg>"}' > f3-vortex-street.svg

# F4 Collision synth: gas whose collisions light up regions and play notes (piano roll strip)
awk -v hdr="$hdr" 'BEGIN{srand(44);print hdr;
 for(i=0;i<2200;i++){x=rand()*960;y=rand()*400;printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"1\" fill=\"#6d7fb8\" opacity=\"0.5\"/>",x,y}
 split("#22e6ff #ff3fd2 #ffe14a #3dff8a",C," ");
 for(k=0;k<9;k++){x=60+rand()*840;y=40+rand()*320;c=C[k%4+1];
  printf "<g filter=\"url(#g)\"><circle cx=\"%.1f\" cy=\"%.1f\" r=\"%.1f\" fill=\"none\" stroke=\"%s\" stroke-width=\"2\"/><circle cx=\"%.1f\" cy=\"%.1f\" r=\"%.1f\" fill=\"none\" stroke=\"%s\" stroke-width=\"1\" opacity=\"0.5\"/><circle cx=\"%.1f\" cy=\"%.1f\" r=\"4\" fill=\"#fff\"/></g>",x,y,14+rand()*16,c,x,y,34+rand()*20,c,x,y;
  printf "<line x1=\"%.1f\" y1=\"%.1f\" x2=\"%.1f\" y2=\"440\" stroke=\"%s\" stroke-width=\"0.8\" opacity=\"0.35\" stroke-dasharray=\"3 5\"/>",x,y,x,c;
  printf "<rect x=\"%.1f\" y=\"%d\" width=\"%d\" height=\"10\" rx=\"3\" fill=\"%s\" filter=\"url(#g)\"/>",x-6,445+int(rand()*7)*12,30+int(rand()*40),c}
 print "<rect x=\"0\" y=\"438\" width=\"960\" height=\"1\" fill=\"#33405f\"/></svg>"}' > f4-collision-synth.svg

# F5 Two inks: two coloured gases shearing into Kelvin-Helmholtz billows
awk -v hdr="$hdr" 'BEGIN{srand(55);print hdr;
 print "<rect width=\"960\" height=\"270\" fill=\"#06222e\"/><rect y=\"270\" width=\"960\" height=\"270\" fill=\"#2a0626\"/><g filter=\"url(#g)\" fill=\"none\">";
 for(b=0;b<6;b++){cx=90+b*160;cy=270;
  for(L=0;L<2;L++){col=L?"#ff3fd2":"#22e6ff";printf "<path d=\"M%.1f %.1f",cx-60,cy; for(t=0;t<12;t+=0.12){r=58-t*4.4;if(r<2)r=2;a=t*(L?1:1)+(L?3.1416:0);printf " L%.1f %.1f",cx+r*cos(a),cy+0.75*r*sin(a)} printf "\" stroke=\"%s\" stroke-width=\"3\" opacity=\"0.9\"/>",col}}
 print "</g>"; for(i=0;i<1600;i++){x=rand()*960;y=rand()*540;c=(y<270)?"#22e6ff":"#ff3fd2";printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"0.9\" fill=\"%s\" opacity=\"0.4\"/>",x,y,c}
 print "</svg>"}' > f5-two-inks.svg

# F6 Sound rings: a kick injects a density pulse; rings travel and bounce off the walls
awk -v hdr="$hdr" 'BEGIN{srand(66);print hdr;
 for(i=0;i<2000;i++){x=rand()*960;y=rand()*540;printf "<circle cx=\"%.1f\" cy=\"%.1f\" r=\"0.9\" fill=\"#5a6fa8\" opacity=\"0.45\"/>",x,y}
 print "<g fill=\"none\" filter=\"url(#g)\">";
 for(k=1;k<=6;k++){r=k*55;printf "<circle cx=\"330\" cy=\"270\" r=\"%d\" stroke=\"#ffe14a\" stroke-width=\"%.1f\" opacity=\"%.2f\"/>",r,4-k*0.5,1.05-k*0.13}
 for(k=1;k<=4;k++){r=k*55+200;printf "<circle cx=\"-130\" cy=\"270\" r=\"%d\" stroke=\"#ff8a2a\" stroke-width=\"1.5\" opacity=\"%.2f\"/>",r,0.5-k*0.08}
 print "</g><circle cx=\"330\" cy=\"270\" r=\"10\" fill=\"#fff\" filter=\"url(#G)\"/><rect x=\"0\" y=\"0\" width=\"6\" height=\"540\" fill=\"#33405f\"/></svg>"}' > f6-sound-rings.svg
ls -la
