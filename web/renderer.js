const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 corner;
layout(location=1) in vec4 body;
layout(location=2) in vec4 data;
uniform vec2 resolution;uniform vec2 camera;uniform float zoom;uniform float interpolation;
out vec2 q;out vec4 info;out float angle;
void main(){q=corner*(data.x<.5?(data.w>=32.?3.:1.65):data.x>16.5?1.8:4.);info=data;angle=body.w;float c=cos(body.w),s=sin(body.w);vec2 p=vec2(c*q.x-s*q.y,s*q.x+c*q.y)*body.z+body.xy;if(data.x<.5)p+=vec2(c,s)*data.z*240.*(interpolation-1.)/60.;vec2 screen=(p-camera)*zoom;gl_Position=vec4(screen/resolution*2.*vec2(1.,-1.),0,1);}
`;
const FRAG = `#version 300 es
precision highp float;
in vec2 q;in vec4 info;in float angle;
uniform float time;out vec4 outColor;
float line(float d,float w){float aa=max(fwidth(d)*.8,.0005);float width=sqrt(w)*.19;return 1.-smoothstep(width-aa,width+aa,abs(d))+.065*exp(-d*d/(w*2.));}
void main(){
 float kind=info.x,variant=info.y,life=info.z,seed=info.w;
 float state=floor(variant),hurt=fract(variant),age=mod(seed,16.),pattern=mod(floor(seed/16.),4.);vec3 col=vec3(.31,.91,.73);float a=0.;float r=length(q),an=atan(q.y,q.x);
 if(kind<.5){
   float action=floor(seed/8.); seed=mod(seed,8.);
   vec2 cell=q/vec2(action>3.5?2.2:action>1.5?1.45:1.,action>3.5?.5:1.);
   r=length(cell);an=atan(cell.y,cell.x);
   // Faceted lantern polyps: a radial carapace and three organelles. No head or tail.
   col=variant<.5?mix(vec3(.22,.65,.57),vec3(.63,1.,.78),seed/6.3):variant<1.5?vec3(.95,.84,.44):variant<2.5?vec3(.62,.65,1.):variant<3.5?vec3(.40,.92,.73):variant<4.5?vec3(.93,.65,.81):vec3(.94,.82,.50);
   float lobes=.68+.12*cos(an*3.+seed)+.025*sin(time*6.+seed);
   a=.045*exp(-r*r*.8)+line(r-lobes,.010)*.66+exp(-r*r*7.)*.24;
   for(int i=0;i<3;i++){float aa=float(i)*2.094+seed;vec2 p=cell-vec2(cos(aa),sin(aa))*.28;a+=exp(-dot(p,p)*95.)*.58;}
   if(variant>2.5&&variant<3.5)a+=line(sin(an*9.+time*2.),.045)*smoothstep(1.25,.7,r)*smoothstep(.5,.8,r)*.22;
   if(variant>3.5)a+=line(length(cell-vec2(.64,.25))-.24,.005)*.6;
   if(action>3.5){col=action>5.5?vec3(.78,.61,1.):vec3(.50,.86,1.);a*=action>5.5?.68:.85;}
   else if(action>1.5){col=mix(col,vec3(1.,.96,.72),.55);a+=line(abs(cell.y)-.35-abs(cell.x)*.3,.006)*smoothstep(1.2,.6,cell.x)*smoothstep(.2,.7,cell.x);}

 }else if(kind<1.5){
   col=vec3(.95,.70,.29);a=.1*exp(-r*r*.22)+.65*exp(-r*r*4.)+.32*line(r-.78,.012);col+=vec3(.16,.19,.19)*exp(-r*r*9.);a*=.8+.2*sin(seed+time*2.);
 }else if(kind<2.5){
   col=vec3(.40,.68,.83);float membrane=.8+.11*cos(an*8.+time*1.4);
   a=line(r-membrane,.002)*.7+line(r-.57,.002)*.25+exp(-r*r*3.)*.10;
   a+=line(sin(an*8.+r*2.+time),.015)*smoothstep(1.6,.7,r)*smoothstep(.4,.9,r)*.22;
   a+=line(length(q*vec2(1.8,2.8))-.4,.018)*.8;
 }else if(kind<3.5){
   col=state==3.?vec3(.43,.98,.72):state==1.?vec3(1.,.65,.32):vec3(.95,.31,.40);
   // Articulated mantis plates, swept fins and a split jaw.
   for(int i=0;i<6;i++){float f=float(i);float coil=state==1.?min(1.,age/1.15):0.;float snap=state==2.?sin(min(1.,age/.7)*3.14159):0.;
     vec2 p=q-vec2(.7-f*(.42-coil*.13+snap*.13),sin(time*4.-f*.72)*(.06+f*.025)+coil*sin(f*.8)*.35);float rad=.52-f*.057;
      float d=length(p/vec2(.34,rad));a+=line(d-.85,.020)*.68+exp(-d*d*1.5)*.12;
      float fin=abs(p.y)-rad-abs(p.x)*1.4;a+=line(fin,.0015)*smoothstep(1.1,.25,abs(p.y))*.48;}
   float jaw=abs(q.y)-(state==1.?.55:state==2.?.10:.24+.07*sin(time*3.))*smoothstep(1.9,.7,q.x);a+=line(jaw,.004)*smoothstep(1.9,1.,q.x)*smoothstep(.6,1.,q.x)*.8;
   a+=line(length((q+vec2(.6,0.))*vec2(1.1,1.8))-.37,.007)*(state==3.?.9:.12);
   a+=exp(-dot(q-vec2(.75,.20),q-vec2(.75,.20))*160.)+exp(-dot(q-vec2(.75,-.20),q-vec2(.75,-.20))*160.);
 }else if(kind<4.5){
   col=state==3.?vec3(.42,.94,.69):state==1.?vec3(.95,.60,.39):vec3(.70,.36,.70);
   float pull=state==1.?min(1.,age/1.8):0.;float snap=state==2.?exp(-age*5.):0.;r/=1.-pull*.28+snap*.45;float petal=sin(an*11.+sin(r*4.-time*1.8)*.7+pull*r*2.);
   a=.06*exp(-r*r*.4)+line(r-.62,.009)*.75+line(petal,.016)*smoothstep(2.1,.65,r)*smoothstep(.3,.8,r)*.65;
   a+=line(r-(1.65+.27*cos(an*11.+time*.6)),.002)*.48;
   a+=line(r-(state==3.?.30:.12),.003)*.85;
 }else if(kind<5.5){
   // The Cathedral: an eclipse, overlapping crown plates and six jointed feeding arms.
   col=state==3.?vec3(.52,1.,.80):state==1.?vec3(1.,.68,.40):mix(vec3(.89,.64,.36),vec3(.88,.40,.54),1.-life);
   float open=state==3.?1.:0.;float core=.36+open*.22;
   a=.045*exp(-r*r*.3)+line(r-core,.001)*1.0+line(r-core-.05,.0006)*.50;
   float breath=state==1.?-.14*min(1.,age/2.2):state==2.?.12*exp(-age*5.):0.;float crown=1.05+breath+.16*cos(an*12.+time*.09);
   a+=line(r-crown,.0012)*.85+line(r-crown*.86,.001)*.35;
   a+=line(sin(an*12.+r*2.),.015)*smoothstep(1.26,.65,r)*smoothstep(core,.8,r)*.35;
   for(int i=0;i<6;i++){float aa=float(i)*1.047;vec2 eye=q-vec2(cos(aa),sin(aa))*.77;a+=line(length(eye)-.025,.0008)*.8;}
   if(state==3.){float veins=sin(an*7.-time*.3+r*10.);a+=line(veins,.012)*smoothstep(core,.1,r)*.35;a+=exp(-r*r*55.)*.6;}
 }else if(kind<6.5){
   col=mix(vec3(.46,.63,.51),vec3(.72,.96,.62),variant);float phi=an+time*.07;float petals=cos(phi*9.+sin(r*4.-time*.5)*.5);float ring=1.+.17*petals+.04*sin(phi*27.+time);
   a=line(r-ring,.0015)*.6+line(r-ring*.75,.001)*.32+line(r-ring*1.5,.0009)*.15;
   a+=line(sin(phi*9.+r*3.),.009)*smoothstep(1.3,.1,r)*smoothstep(.04,.4,r)*.18;
   a+=exp(-r*r*9.)*(.3+life*.8)+.08*exp(-r*r*.7)+line(r-.4-life*.3,.004)*life*.7;
 }else if(kind<7.5){
   col=mix(vec3(.22,.45,.39),vec3(.55,.84,.64),variant);a=exp(-r*r*3.)*(.25+.15*sin(time*.4+seed));
 }else if(kind>8.5&&kind<9.5){
   col=state==3.?vec3(.45,.97,.73):state==1.?vec3(1.,.66,.30):vec3(.71,.59,.90);
   float launch=state==2.?age/1.2:0.;float close=state==1.?age/1.4:0.;float polygon=r*(.91+.09*cos(an*8.+close*.25));a=line(polygon-.82,.004)*.8+line(polygon-.61,.002)*.35;
   float spines=sin(an*8.+sin(time*.6)*.06);a+=line(spines,.0018)*smoothstep(state==3.?1.15:state==2.?2.5+launch*2.:2.5-close*.9,.8,r)*smoothstep(.6,.95,r)*.65;
   a+=line(r-(state==3.?.34:.18),.004)*.9+exp(-r*r*9.)*.18;
 }else if(kind>9.5&&kind<10.5){
   col=state==3.?vec3(.46,.98,.76):state==1.?vec3(1.,.66,.40):vec3(.45,.60,.92);
   float flap=state==1.?-.4*age/1.25:state==2.?sin(age*7.)*.6:sin(time*2.)*.15;float fin=abs(q.y),edge=1.1-fin*.65+sin(fin*2.-time*2.5)*.12+flap*fin;float back=-.8+fin*.12;
   a+=line(q.x-edge,.002)*smoothstep(2.7,2.,fin)*.65+line(q.x-back,.001)*smoothstep(2.5,1.,fin)*.35;
   float inside=smoothstep(edge+.05,edge-.05,q.x)*smoothstep(back-.1,back,q.x)*smoothstep(2.6,2.2,fin);
   a+=inside*(.045+line(sin(fin*9.+q.x*4.-time),.025)*.2);
   a+=line(length(q*vec2(1.,3.))-.67,.009)*.75;
   a+=exp(-dot(q-vec2(.5,.12),q-vec2(.5,.12))*250.)*.8;
 }else if(kind>10.5&&kind<11.5){
   col=variant<.5?vec3(.85,.62,1.):vec3(.48,.76,1.);float petal=.65+.15*cos(an*4.+seed+time*3.);
   a=line(r-petal,.008)*.8+exp(-r*r*6.)*.4;
 }else if(kind>11.5&&kind<12.5){
   // Every capsule links two actual simulated joints, with taper and a crisp chitin edge.
   col=state==2.?vec3(1.,.36,.31):vec3(.94,.72,.40);
   float d=length(vec2(max(abs(q.x)-1.,0.),q.y))-life;
   a=line(d,.0015)*.85+smoothstep(.01,-.01,d)*.13;
   a+=line(q.y,.0008)*smoothstep(1.,.85,abs(q.x))*.32;
   a+=line(length(q-vec2(-1.,0.))-life*1.05,.001)*.7;
 }else if(kind>13.5&&kind<14.5){
   col=vec3(.71,.56,1.);a=exp(-r*r*2.)*.07*life;
 }else if(kind>16.5){
   col=vec3(.73,.62,1.);float petal=.68+.12*cos(an*3.+seed);a=(line(r-petal,.007)*.9+exp(-r*r*8.)*.5)*life;
 }else if(kind>15.5){
   col=vec3(1.,.58,.37);float d=max(abs(q.y)*1.6+q.x*.35-.25,-q.x-1.2);a=line(d,.005)*.95+smoothstep(.02,-.02,d)*.17;
 }else if(kind>14.5){
   col=vec3(1.,.50,.37);vec2 p=q/vec2(1.8,.6);a=(line(length(p)-.65,.012)*.9+exp(-dot(p,p)*4.)*.4)*life;
 }else{
   col=variant<.5?vec3(.48,1.,.73):variant<1.5?vec3(1.,.75,.33):variant<2.5?vec3(.99,.36,.36):vec3(.67,.61,1.);a=exp(-r*r*2.)*life;
 }
 float windup=kind<3.5?1.15:kind<4.5?1.8:kind<5.5?2.2:kind<9.5?1.4:1.25;
 if(state==1.&&seed<64.&&age>windup*.62&&(kind>2.5&&kind<5.5||kind>8.5&&kind<10.5))col=mix(col,vec3(1.,1.,.90),.8);
 if(kind>2.5&&kind<5.5||kind>8.5&&kind<10.5)col=mix(col,vec3(1.,.97,.83),min(hurt*6.,.7));
 outColor=vec4(col,a);if(a<.003)discard;
}
`;
const BG_VERT = `#version 300 es
in vec2 p;out vec2 uv;void main(){uv=p;gl_Position=vec4(p,0,1);}`;
const BG_FRAG = `#version 300 es
precision highp float;in vec2 uv;out vec4 outColor;uniform vec2 resolution;uniform vec2 camera;uniform float zoom;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.;v+=noise(p)*.5;p=p*2.03+17.;v+=noise(p)*.25;p=p*2.01+31.;v+=noise(p)*.125;p=p*2.02;v+=noise(p)*.0625;return v;}
void main(){vec2 world=uv*resolution*.5/zoom*vec2(1,-1)+camera;vec2 p=world*.0013;
 float n=fbm(p+vec2(time*.008,0));float clouds=fbm(p*1.7+vec2(n*2.,time*.009));
 float violet=smoothstep(200.,1600.,-world.y);float thermal=smoothstep(500.,2200.,world.x)*smoothstep(-200.,1200.,world.y);
 vec3 base=mix(vec3(.012,.044,.053),vec3(.025,.030,.065),violet);base=mix(base,vec3(.056,.031,.039),thermal*.7);
 vec3 mist=mix(vec3(.013,.070,.068),vec3(.045,.033,.080),violet);mist=mix(mist,vec3(.080,.036,.021),thermal*.6);
 vec3 col=base+mist*pow(clouds*1.6,2.);
 float contour=abs(sin((fbm(p*.7+n*.35)+n*.25)*80.));col+=vec3(.015,.044,.036)*smoothstep(.065,0.,contour)*.32;
 float rays=pow(max(0.,sin(p.x*3.+p.y*.8+n*3.)),12.)*.024;col+=vec3(.4,.8,.68)*rays;
 col+=(hash(gl_FragCoord.xy+fract(time))-.5)*.009;
 outColor=vec4(col,1.);}
`;
const LINE_VERT = `#version 300 es
layout(location=0) in vec2 p;layout(location=1) in vec4 color;uniform vec2 resolution;uniform vec2 camera;uniform float zoom;out vec4 c;void main(){gl_Position=vec4((p-camera)*zoom/resolution*2.*vec2(1,-1),0,1);c=color;}`;
const LINE_FRAG = `#version 300 es
precision highp float;in vec4 c;out vec4 outColor;void main(){outColor=c;}`;
function program(gl, vs, fs) {
  const p = gl.createProgram();
  for (const [type, source] of [
    [gl.VERTEX_SHADER, vs],
    [gl.FRAGMENT_SHADER, fs],
  ]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, source);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
    gl.deleteShader(s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS))
    throw Error(gl.getProgramInfoLog(p));
  return p;
}
function rng(seed) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
}
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = (this.gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      powerPreference: "high-performance",
    }));
    if (!gl)
      throw Error(
        "Swarmkeeper needs WebGL 2. Please open it in a recent Safari, Chrome, or Firefox browser.",
      );
    this.bg = program(gl, BG_VERT, BG_FRAG);
    this.organisms = program(gl, VERT, FRAG);
    this.lines = program(gl, LINE_VERT, LINE_FRAG);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );
    this.bgVao = gl.createVertexArray();
    gl.bindVertexArray(this.bgVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.instances = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    for (let i = 1; i <= 2; i++) {
      gl.enableVertexAttribArray(i);
      gl.vertexAttribPointer(i, 4, gl.FLOAT, false, 32, (i - 1) * 16);
      gl.vertexAttribDivisor(i, 1);
    }
    this.lineVao = gl.createVertexArray();
    gl.bindVertexArray(this.lineVao);
    this.lineBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 24, 8);
    this.uniforms = new Map();
    for (const p of [this.bg, this.organisms, this.lines]) {
      const u = {};
      for (const n of ["resolution", "camera", "zoom", "time", "interpolation"])
        u[n] = gl.getUniformLocation(p, n);
      this.uniforms.set(p, u);
    }
    this.particles = [];
    this.rings = [];
    this.bolts = [];
    this.visible = new Float32Array(150000);
    this.lineData = new Float32Array(220000);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instances);
    gl.bufferData(gl.ARRAY_BUFFER, this.visible.byteLength, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.lineData.byteLength, gl.DYNAMIC_DRAW);
    this.plants = [];
    this.motes = [];
    const r = rng(9371);
    for (let i = 0; i < 150; i++) {
      let x = (r() - 0.5) * 5300,
        y = (r() - 0.5) * 5300;
      this.plants.push({
        x,
        y,
        size: 45 + r() * 130,
        seed: r() * 6.28,
        kind: i % 3,
      });
    }
    // Deliberately composed starting habitat; all geometry is generated below.
    this.plants.push(
      { x: -280, y: 190, size: 170, seed: 1.5, kind: 0 },
      { x: 340, y: -290, size: 190, seed: 4.3, kind: 1 },
      { x: 610, y: 210, size: 150, seed: 2.1, kind: 0 },
    );
    for (let i = 0; i < 1500; i++)
      this.motes.push([
        (r() - 0.5) * 6000,
        (r() - 0.5) * 6000,
        0.8 + r() * 1.5,
        r() * 6.28,
      ]);
    this.resize();
  }
  resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.dpr = Math.min(devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }
  uniformsFor(p, camera, zoom, time) {
    let g = this.gl,
      u = this.uniforms.get(p);
    g.useProgram(p);
    g.uniform2f(u.resolution, this.width, this.height);
    g.uniform2f(u.camera, camera.x, camera.y);
    g.uniform1f(u.zoom, zoom);
    g.uniform1f(u.time, time);
    g.uniform1f(u.interpolation, this.interpolation ?? 1);
  }
  burst(x, y, count = 20, color = 0, force = 100) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2,
        v = force * (0.2 + Math.random());
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1,
        max: 0.5 + Math.random() * 0.8,
        color,
        size: 1 + Math.random() * 2,
      });
    }
    if (this.particles.length > 2500)
      this.particles.splice(0, this.particles.length - 2500);
  }
  ring(x, y, color = 0, radius = 300) {
    this.rings.push({ x, y, color, radius, age: 0 });
  }
  bolt(x, y, tx, ty) {
    this.bolts.push({ x, y, tx, ty, age: 0, seed: Math.random() * 100 });
  }
  draw(frame, camera, zoom, time, dt) {
    const g = this.gl;
    g.disable(g.BLEND);
    this.uniformsFor(this.bg, camera, zoom, time);
    g.bindVertexArray(this.bgVao);
    g.drawArrays(g.TRIANGLES, 0, 6);
    g.enable(g.BLEND);
    g.blendFunc(g.SRC_ALPHA, g.ONE);
    let li = 0;
    const line = (x, y, xx, yy, c, a) => {
      if (li + 12 > this.lineData.length) return;
      const d = this.lineData;
      d[li++] = x;
      d[li++] = y;
      d[li++] = c[0];
      d[li++] = c[1];
      d[li++] = c[2];
      d[li++] = a;
      d[li++] = xx;
      d[li++] = yy;
      d[li++] = c[0];
      d[li++] = c[1];
      d[li++] = c[2];
      d[li++] = a;
    };
    const inView = (x, y, margin = 100) =>
      Math.abs(x - camera.x) < (this.width / zoom) * 0.5 + margin &&
      Math.abs(y - camera.y) < (this.height / zoom) * 0.5 + margin;
    for (const p of this.plants) {
      if (!inView(p.x, p.y, p.size * 2)) continue;
      const col = p.kind === 1 ? [0.27, 0.4, 0.48] : [0.18, 0.43, 0.35];
      const arms = p.kind === 2 ? 7 : 13;
      for (let arm = 0; arm < arms; arm++) {
        let prevX = p.x,
          prevY = p.y;
        const theta = p.seed + (arm - (arms - 1) / 2) * 0.105;
        const length =
          p.size * (0.55 + 0.45 * Math.sin(arm * 7.12 + p.seed) ** 2);
        for (let j = 1; j <= 18; j++) {
          const f = j / 18;
          const a = theta + Math.sin(f * 3 + time * 0.35 + p.seed) * f * 0.22;
          const x = p.x + Math.cos(a) * length * f,
            y = p.y + Math.sin(a) * length * f;
          line(prevX, prevY, x, y, col, (1 - f * 0.65) * 0.36);
          if (j > 3 && j % 2 === 0) {
            for (let side = -1; side <= 1; side += 2) {
              const aa = a + side * 0.72;
              line(
                x,
                y,
                x + Math.cos(aa) * length * 0.14 * (1 - f * 0.6),
                y + Math.sin(aa) * length * 0.14 * (1 - f * 0.6),
                col,
                0.14,
              );
            }
          }
          prevX = x;
          prevY = y;
        }
      }
    }
    for (let i = 0; i < frame.length; i += 56) {
      if (
        frame[i + 4] !== 0 ||
        frame[i + 7] < 16 ||
        !inView(frame[i], frame[i + 1])
      )
        continue;
      const evade = frame[i + 7] >= 32,
        angle = frame[i + 3],
        speed = frame[i + 6] * 240;
      line(
        frame[i],
        frame[i + 1],
        frame[i] - Math.cos(angle) * speed * (evade ? 0.09 : 0.025),
        frame[i + 1] - Math.sin(angle) * speed * (evade ? 0.09 : 0.025),
        evade ? [0.35, 0.68, 1] : [0.95, 0.85, 0.55],
        evade ? 0.18 : 0.28,
      );
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.age += dt;
      if (r.age > 1.4) {
        this.rings.splice(i, 1);
        continue;
      }
      const radius = r.radius * (1 - Math.exp(-r.age * 2.7)),
        alpha = (1 - r.age / 1.4) * 0.7;
      const col = r.color === 3 ? [0.65, 0.65, 1] : [0.55, 1, 0.75];
      for (let j = 0; j < 100; j++) {
        const a = (j / 100) * Math.PI * 2,
          b = ((j + 1) / 100) * Math.PI * 2;
        line(
          r.x + Math.cos(a) * radius,
          r.y + Math.sin(a) * radius,
          r.x + Math.cos(b) * radius,
          r.y + Math.sin(b) * radius,
          col,
          alpha,
        );
      }
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.age += dt;
      if (b.age > 0.65) {
        this.bolts.splice(i, 1);
        continue;
      }
      let px = b.x,
        py = b.y;
      for (let j = 1; j <= 14; j++) {
        let f = j / 14,
          w = Math.sin(f * Math.PI) * 20,
          xx =
            b.x +
            (b.tx - b.x) * f +
            Math.sin(j * 71.3 + Math.floor(b.age * 24)) * w,
          yy =
            b.y +
            (b.ty - b.y) * f +
            Math.cos(j * 39.7 + Math.floor(b.age * 24)) * w;
        line(px, py, xx, yy, [0.65, 0.72, 1], (1 - b.age / 0.65) * 0.9);
        line(px + 1, py, xx + 1, yy, [0.37, 0.43, 1], (1 - b.age / 0.65) * 0.3);
        px = xx;
        py = yy;
      }
    }
    this.uniformsFor(this.lines, camera, zoom, time);
    g.bindVertexArray(this.lineVao);
    g.bindBuffer(g.ARRAY_BUFFER, this.lineBuffer);
    g.bufferSubData(g.ARRAY_BUFFER, 0, this.lineData.subarray(0, li));
    g.drawArrays(g.LINES, 0, li / 6);
    let length = 0;
    const add = (x, y, size, angle, kind, color, life, seed) => {
      if (length + 8 >= this.visible.length) return;
      const v = this.visible;
      v[length++] = x;
      v[length++] = y;
      v[length++] = size;
      v[length++] = angle;
      v[length++] = kind;
      v[length++] = color;
      v[length++] = life;
      v[length++] = seed;
    };
    for (const m of this.motes) {
      let x = m[0] + Math.sin(time * 0.08 + m[3]) * 25,
        y = m[1] + Math.cos(time * 0.06 + m[3]) * 25;
      if (inView(x, y, 10)) add(x, y, m[2], 0, 7, m[3] / 6, 1, m[3]);
    }
    for (let i = 0; i < frame.length; i += 8)
      if (
        length + 8 <= this.visible.length &&
        inView(frame[i], frame[i + 1], frame[i + 2] * 4)
      ) {
        for (let j = 0; j < 8; j++) this.visible[length++] = frame[i + j];
      }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt / p.max;
      if (p.life <= 0) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-dt * 2);
      p.vy *= Math.exp(-dt * 2);
      if (inView(p.x, p.y, 20)) add(p.x, p.y, p.size, 0, 8, p.color, p.life, 0);
    }
    this.uniformsFor(this.organisms, camera, zoom, time);
    g.bindVertexArray(this.vao);
    g.bindBuffer(g.ARRAY_BUFFER, this.instances);
    g.bufferSubData(g.ARRAY_BUFFER, 0, this.visible.subarray(0, length));
    g.drawArraysInstanced(g.TRIANGLES, 0, 6, length / 8);
    this.visibleCount = length / 8;
  }
}
