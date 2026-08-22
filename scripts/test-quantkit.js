/* quantkit pure-logic test suite. Mirrors the unit tables + convert()/fmt()
 from site/quantkit.html. Ground truth for linear categories: exact factors
 (verified against Python fractions). Temperature via the standard offset
 formulas (verified against Python). */

const CATS=[
  {key:'length', base:'m', units:[
    ['m',1],['km',1000],['cm',0.01],['mm',0.001],['um',1e-6],
    ['mi',1609.344],['yd',0.9144],['ft',0.3048],['in',0.0254],['nmi',1852]
  ]},
  {key:'mass', base:'kg', units:[
    ['kg',1],['g',0.001],['mg',1e-6],['t',1000],['lb',0.45359237],
    ['oz',0.028349523125],['st',6.35029318],['ton_us',907.18474]
  ]},
  {key:'temp', base:'C', isTemp:true, units:[
    ['C',null],['F',null],['K',null]
  ]},
  {key:'volume', base:'L', units:[
    ['L',1],['mL',0.001],['m3',1000],['cm3',0.001],['gal_us',3.785411784],
    ['qt_us',0.946352946],['pt_us',0.473176473],['cup',0.236588236],
    ['floz',0.02957352956],['gal_uk',4.54609]
  ]},
  {key:'data', base:'B', units:[
    ['B',1],['KB',1000],['MB',1e6],['GB',1e9],['TB',1e12],['PB',1e15],
    ['KiB',1024],['MiB',1048576],['GiB',1073741824]
  ]},
  {key:'time', base:'s', units:[
    ['s',1],['ms',0.001],['min',60],['hr',3600],['day',86400],
    ['week',604800],['yr',31557600]
  ]},
  {key:'speed', base:'m/s', units:[
    ['m/s',1],['kmh',0.2777777778],['mph',0.44704],['knot',0.5144444444],['fts',0.3048]
  ]},
  {key:'angle', base:'deg', units:[
    ['deg',1],['rad',57.29577951308232],['grad',0.9],['turn',360]
  ]}
];

function catFor(key){ for(let i=0;i<CATS.length;i++) if(CATS[i].key===key) return CATS[i]; return CATS[0]; }
function catContains(cat,tok){ const u=cat.units; for(let i=0;i<u.length;i++) if(u[i][0]===tok) return true; return false; }
function unitFactor(cat,tok){ const u=cat.units; for(let i=0;i<u.length;i++) if(u[i][0]===tok) return u[i][1]; return null; }
function toC(v,u){ if(u==='C')return v; if(u==='F')return (v-32)*5/9; return v-273.15; }
function fromC(c,u){ if(u==='C')return c; if(u==='F')return c*9/5+32; return c+273.15; }
function convert(cat,v,fromTok,toTok){
  if(cat.key==='temp') return fromC(toC(v,fromTok),toTok);
  const fIn=unitFactor(cat,fromTok), fOut=unitFactor(cat,toTok);
  if(fIn===null||fOut===null) return NaN;
  return v*fIn/fOut;
}
function fmt(v){
  if(!isFinite(v)) return '∞';
  if(v===0) return '0';
  const a=Math.abs(v);
  if(a>=1e15||a<1e-9){
    let e=v.toExponential(6);
    e=e.replace(/(\.\d*?)0+e/,'$1e').replace(/\.e/,'e');
    e=e.replace(/e(\+?)(-?\d)$/,'e$1'+'0'+'$2');
    return e;
  }
  return String(parseFloat(v.toPrecision(12)));
}

let pass=0, fail=0;
function T(name,cond){ if(cond){pass++;} else {fail++; console.log('  FAIL:',name);} }

/* categories + containment */
T('length 10 units', CATS[0].units.length===10);
T('mass 8 units', CATS[1].units.length===8);
T('volume 10 units', CATS[3].units.length===10);
T('temp lookup', catFor('temp').key==='temp');
T('contains ft', catContains(catFor('length'),'ft'));
T('not contains mile in mass', !catContains(catFor('mass'),'mile'));

/* length */
T('mi->ft 1 = 5280', convert(catFor('length'),1,'mi','ft')===5280);
T('ft->in 1 = 12', Math.abs(convert(catFor('length'),1,'ft','in')-12)<1e-9);
T('km->m 3 = 3000', convert(catFor('length'),3,'km','m')===3000);
T('cm->mm 2.5 = 25', convert(catFor('length'),2.5,'cm','mm')===25);
T('mi->km 1 = 1.609344', Math.abs(convert(catFor('length'),1,'mi','km')-1.609344)<1e-9);

/* mass */
T('kg->g 2 = 2000', convert(catFor('mass'),2,'kg','g')===2000);
T('t->kg 1 = 1000', convert(catFor('mass'),1,'t','kg')===1000);
T('lb->oz 1 = 16', convert(catFor('mass'),1,'lb','oz')===16);
T('st->lb 1 = 14', Math.abs(convert(catFor('mass'),1,'st','lb')-14)<1e-9);
T('us ton->lb 1 = 2000', convert(catFor('mass'),1,'ton_us','lb')===2000);

/* volume */
T('L->mL 1.5 = 1500', convert(catFor('volume'),1.5,'L','mL')===1500);
T('m3->L 1 = 1000', convert(catFor('volume'),1,'m3','L')===1000);
T('gal_us->qt_us 1 = 4', convert(catFor('volume'),1,'gal_us','qt_us')===4);
T('qt_us->pt_us 1 = 2', convert(catFor('volume'),1,'qt_us','pt_us')===2);
T('pt_us->floz 1 = 16', Math.abs(convert(catFor('volume'),1,'pt_us','floz')-16)<1e-6);
T('gal_us->L 1 exact', Math.abs(convert(catFor('volume'),1,'gal_us','L')-3.785411784)<1e-9);

/* data */
T('KB->B 1 = 1000', convert(catFor('data'),1,'KB','B')===1000);
T('KiB->B 1 = 1024', convert(catFor('data'),1,'KiB','B')===1024);
T('GiB->MiB 1 = 1024', convert(catFor('data'),1,'GiB','MiB')===1024);
T('GB->MB 5 = 5000', convert(catFor('data'),5,'GB','MB')===5000);
T('MB->KiB 1 exact', Math.abs(convert(catFor('data'),1,'MB','KiB')-(1000000/1024))<1e-9);

/* time */
T('min->s 3 = 180', convert(catFor('time'),3,'min','s')===180);
T('hr->min 2 = 120', convert(catFor('time'),2,'hr','min')===120);
T('day->hr 1 = 24', convert(catFor('time'),1,'day','hr')===24);
T('week->day 1 = 7', convert(catFor('time'),1,'week','day')===7);
T('ms->s 500 = 0.5', convert(catFor('time'),500,'ms','s')===0.5);
T('yr->week 1 exact', Math.abs(convert(catFor('time'),1,'yr','week')-(31557600/604800))<1e-9);

/* speed */
T('kmh->ms 36 = 10', Math.abs(convert(catFor('speed'),36,'kmh','m/s')-10)<1e-9);
T('mph->kmh 1 = 1.609344', Math.abs(convert(catFor('speed'),1,'mph','kmh')-1.609344)<1e-6);
T('knot->m/s 1 exact', Math.abs(convert(catFor('speed'),1,'knot','m/s')-0.5144444444)<1e-9);
T('fts->ms 1 = 0.3048', convert(catFor('speed'),1,'fts','m/s')===0.3048);

/* angle */
T('deg->rad 180 = pi', Math.abs(convert(catFor('angle'),180,'deg','rad')-Math.PI)<1e-9);
T('deg->turn 90 = 0.25', convert(catFor('angle'),90,'deg','turn')===0.25);
T('rad->grad pi/2 = 100', Math.abs(convert(catFor('angle'),Math.PI/2,'rad','grad')-100)<1e-9);
T('turn->deg 1 = 360', convert(catFor('angle'),1,'turn','deg')===360);

/* temperature */
T('C->K 0 = 273.15', convert(catFor('temp'),0,'C','K')===273.15);
T('C->F 100 = 212', convert(catFor('temp'),100,'C','F')===212);
T('F->C 32 = 0', convert(catFor('temp'),32,'F','C')===0);
/* Fahrenheit 212 -> Kelvin. 212F = 100C = 373.15K. */
T('F->K 212 = 373.15', Math.abs(convert(catFor('temp'),212,'F','K')-373.15)<1e-9);
T('K->C 0 = -273.15', convert(catFor('temp'),0,'K','C')===-273.15);
T('K->F 273.15 = 32', convert(catFor('temp'),273.15,'K','F')===32);
T('temp roundtrip 98.6F', Math.abs(convert(catFor('temp'),convert(catFor('temp'),98.6,'F','C'),'C','F')-98.6)<1e-9);

/* fmt */
T('fmt 5', fmt(5)==='5');
T('fmt 0', fmt(0)==='0');
T('fmt 1e20', fmt(1e20)==='1e+20');
T('fmt 3e-9', fmt(3e-9)==='3e-9');
T('fmt 1/3 strict', fmt(1/3).startsWith('0.333'));
T('fmt inf', fmt(Infinity)==='∞');

/* robustness */
T('unknown unit -> NaN', isNaN(convert(catFor('length'),1,'furlong','m')));
T('unknown unitFactor -> null', unitFactor(catFor('length'),'xxx')===null);

console.log('quantkit: pass='+pass+' fail='+fail);
process.exit(fail?1:0);