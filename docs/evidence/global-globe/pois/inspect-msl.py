import spiceypy as spice
import json,math
from pathlib import Path
here=Path(__file__).resolve().parent
root=here.parents[3]
prior=root/'docs/evidence/scientific-resolution-2026-11-14/registration'
for name in ['pck00010.tpc','naif0012.tls']: spice.furnsh(str(prior/name))
name='msl_ls_ops120808_iau2000_v1.bsp'; p=here/name
spice.furnsh(str(p)); ids=list(spice.spkobj(str(p)))
handle=spice.dafopr(str(p)); count,comments,done=spice.dafec(handle,1000,512); spice.dafcls(handle)
(here/'msl-landing-comments.txt').write_text('\n'.join(comments[:count])+'\n')
result=[]
for code in ids:
    intervals=spice.spkcov(str(p),code); epoch=(intervals[0]+intervals[1])/2
    vector,_=spice.spkpos(str(code),epoch,'IAU_MARS','NONE','499')
    radius,lon,lat=spice.reclat(vector)
    result.append(dict(code=code,frame='IAU_MARS',xyzKm=vector.tolist(),longitude=math.degrees(lon),latitude=math.degrees(lat),radiusKm=radius))
(here/'msl-landing-coordinate.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
