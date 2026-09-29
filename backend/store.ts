import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Room } from './types';
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
// All durable writes pass through this boundary; a PostgreSQL adapter can replace it.
export class Store {
  db: DatabaseSync;
  constructor(filename: string) {
    mkdirSync(dirname(filename), {recursive:true}); this.db=new DatabaseSync(filename);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT NOT NULL,token_hash TEXT UNIQUE NOT NULL);
      CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id),avatar INTEGER NOT NULL DEFAULT 0,bio TEXT NOT NULL DEFAULT '',created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,snapshot TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS results(game_id TEXT PRIMARY KEY,room TEXT,finished_at INTEGER,result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,room TEXT,revision INTEGER,kind TEXT,created_at INTEGER);
      CREATE TABLE IF NOT EXISTS requests(user_id TEXT,request_id TEXT,result TEXT,PRIMARY KEY(user_id,request_id));`);
  }
  createUser(name: string) {
    const id=randomUUID(),token=randomBytes(32).toString('hex');
    this.db.prepare('INSERT INTO users VALUES(?,?,?)').run(id,name,hash(token)); return {id,name,token};
  }
  user(token: string) { return this.db.prepare('SELECT users.id,users.name,COALESCE(profiles.avatar,0) AS avatar FROM users LEFT JOIN profiles ON profiles.user_id=users.id WHERE token_hash=?').get(hash(token)) as {id:string;name:string;avatar:number}|undefined; }
  profile(user: {id:string;name:string}) {
    const info=this.db.prepare('SELECT avatar,bio,created_at FROM profiles WHERE user_id=?').get(user.id);
    const rows=this.db.prepare("SELECT finished_at,result FROM results WHERE EXISTS (SELECT 1 FROM json_each(results.result,'$.members') WHERE json_extract(value,'$.id')=?) ORDER BY finished_at DESC").all(user.id);
    const history=rows.map(row=>{const r=JSON.parse(String(row.result)),seat=r.members.findIndex((m:{id:string})=>m.id===user.id),g=r.game,winner=g.score<80?g.dealer%2:1-g.dealer%2;return {date:row.finished_at,room:r.room||null,level:g.level,trump:g.trump,score:g.score,won:seat%2===winner};});
    return {...user,avatar:Number(info?.avatar||0),bio:String(info?.bio||''),joinedAt:info?.created_at||null,stats:{games:history.length,wins:history.filter(h=>h.won).length},history:history.slice(0,20)};
  }
  updateProfile(user:string,name:string,avatar:number,bio:string){
    this.db.exec('BEGIN IMMEDIATE');try{
      this.db.prepare('UPDATE users SET name=? WHERE id=?').run(name,user);
      this.db.prepare('INSERT INTO profiles VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET avatar=excluded.avatar,bio=excluded.bio').run(user,avatar,bio,Date.now());
      this.db.exec('COMMIT');
    }catch(error){this.db.exec('ROLLBACK');throw error;}
  }
  rooms(): Room[] { return this.db.prepare('SELECT snapshot FROM rooms').all().map(r=>JSON.parse(String(r.snapshot))); }
  result(user: string,id: string) { const r=this.db.prepare('SELECT result FROM requests WHERE user_id=? AND request_id=?').get(user,id);return r?JSON.parse(String(r.result)):null; }
  save(room: Room,kind: string,request?: {user:string;id:string;result:unknown}) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.db.prepare('INSERT INTO rooms VALUES(?,?) ON CONFLICT(code) DO UPDATE SET snapshot=excluded.snapshot').run(room.code,JSON.stringify(room));
      this.db.prepare('INSERT INTO events(room,revision,kind,created_at) VALUES(?,?,?,?)').run(room.code,room.revision,kind,Date.now());
      if(room.game?.phase==='over')this.db.prepare('INSERT OR IGNORE INTO results VALUES(?,?,?,?)').run(room.game.id,room.code,Date.now(),JSON.stringify({room:room.code,members:room.members,round:room.round,levels:room.levels,game:room.game}));
      if(request)this.db.prepare('INSERT INTO requests VALUES(?,?,?)').run(request.user,request.id,JSON.stringify(request.result));
      this.db.exec('COMMIT');
    } catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close(){this.db.close();}
}
