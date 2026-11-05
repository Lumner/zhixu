'use strict';
// Educational RV32I integer subset. No ecall, CSR, fence, MMU or timing model.
// ebreak is deliberately treated as a host stop instead of an architectural trap.
const hex = n => '0x' + (n >>> 0).toString(16).padStart(8, '0');
const sx = (value, bits) => (value << (32 - bits)) >> (32 - bits);
function fields(word) {
  return {opcode:word & 127, rd:(word >>> 7) & 31, f3:(word >>> 12) & 7,
    rs1:(word >>> 15) & 31, rs2:(word >>> 20) & 31, f7:word >>> 25};
}
class CPU {
  constructor(bytes = 1024) {
    if (!Number.isInteger(bytes) || bytes < 4 || bytes > 0x1000000) throw Error('Invalid memory size');
    this.memory = new DataView(new ArrayBuffer(bytes));
    this.r = new Uint32Array(32);
    this.pc = 0; this.steps = 0; this.halted = false;
  }
  check(address, size) {
    if (!Number.isInteger(address) || address < 0 || address + size > this.memory.byteLength) throw Error('Memory range: '+hex(address));
    if (address % size) throw Error('Misaligned access: '+hex(address));
  }
  loadWords(words, base = 0) {
    this.check(base, 4);
    if (base + words.length * 4 > this.memory.byteLength) throw Error('Program too large');
    words.forEach((word, i) => this.memory.setUint32(base + i * 4, word >>> 0, true));
  }
  step() {
    if (this.halted) throw Error('CPU is halted');
    const pc = this.pc; this.check(pc, 4);
    const word = this.memory.getUint32(pc, true);
    const {opcode, rd, f3, rs1, rs2, f7} = fields(word);
    // x0 always reads zero even if a caller accidentally mutated the backing array.
    const a = rs1 === 0 ? 0 : this.r[rs1], b = rs2 === 0 ? 0 : this.r[rs2];
    const immI = word >> 20;
    let nextPC = (pc + 4) >>> 0, result, op, memory;
    const invalid = () => { throw Error('Unsupported/illegal encoding: '+hex(word)); };
    const target = value => {
      value = value >>> 0;
      if (value % 4) throw Error('Misaligned instruction target: '+hex(value));
      return value;
    };
    if (opcode === 0x13) {
      switch (f3) {
        case 0: op='addi'; result=a+immI; break;
        case 2: op='slti'; result=Number((a|0)<immI); break;
        case 3: op='sltiu'; result=Number(a<(immI>>>0)); break;
        case 4: op='xori'; result=a^immI; break;
        case 6: op='ori'; result=a|immI; break;
        case 7: op='andi'; result=a&immI; break;
        case 1:
          if(f7!==0) invalid(); op='slli'; result=a<<rs2; break;
        case 5:
          if(f7===0){op='srli';result=a>>>rs2;}
          else if(f7===0x20){op='srai';result=a>>rs2;}
          else invalid(); break;
        default: invalid();
      }
    } else if (opcode === 0x33) {
      if (f7 !== 0 && !(f7 === 0x20 && (f3 === 0 || f3 === 5))) invalid();
      switch(f3) {
        case 0: op=f7===0?'add':'sub'; result=f7===0?a+b:a-b; break;
        case 1: op='sll'; result=a<<(b&31); break;
        case 2: op='slt'; result=Number((a|0)<(b|0)); break;
        case 3: op='sltu'; result=Number(a<b); break;
        case 4: op='xor'; result=a^b; break;
        case 5: op=f7===0?'srl':'sra'; result=f7===0?a>>>(b&31):a>>(b&31); break;
        case 6: op='or'; result=a|b; break;
        case 7: op='and'; result=a&b; break;
        default: invalid();
      }
    } else if (opcode === 0x03) {
      const types={0:['lb',1,true],1:['lh',2,true],2:['lw',4,false],4:['lbu',1,false],5:['lhu',2,false]};
      if(!types[f3]) invalid();
      const [name,size,signed]=types[f3], address=(a+immI)>>>0;
      op=name; this.check(address,size);
      if(size===1) result=signed?this.memory.getInt8(address):this.memory.getUint8(address);
      else if(size===2) result=signed?this.memory.getInt16(address,true):this.memory.getUint16(address,true);
      else result=this.memory.getUint32(address,true);
      memory={kind:'read',address,size,value:result>>>0};
    } else if (opcode === 0x23) {
      const types={0:['sb',1],1:['sh',2],2:['sw',4]}; if(!types[f3]) invalid();
      const imm=sx(((word>>>25)<<5)|((word>>>7)&31),12);
      const [name,size]=types[f3],address=(a+imm)>>>0; op=name; this.check(address,size);
      const value=size===1?b&255:size===2?b&65535:b;
      if(size===1)this.memory.setUint8(address,value);
      else if(size===2)this.memory.setUint16(address,value,true);
      else this.memory.setUint32(address,value,true);
      memory={kind:'write',address,size,value};
    } else if (opcode === 0x63) {
      const imm=sx(((word>>>31)<<12)|(((word>>>7)&1)<<11)|(((word>>>25)&63)<<5)|(((word>>>8)&15)<<1),13);
      const comparisons={0:['beq',a===b],1:['bne',a!==b],4:['blt',(a|0)<(b|0)],5:['bge',(a|0)>=(b|0)],6:['bltu',a<b],7:['bgeu',a>=b]};
      if(!comparisons[f3])invalid(); const [name,taken]=comparisons[f3]; op=name;
      if(taken)nextPC=target(pc+imm);
    } else if (opcode === 0x37) {op='lui';result=word&0xfffff000;
    } else if (opcode === 0x17) {op='auipc';result=pc+(word&0xfffff000);
    } else if (opcode === 0x6f) {
      const imm=sx(((word>>>31)<<20)|(((word>>>12)&255)<<12)|(((word>>>20)&1)<<11)|(((word>>>21)&1023)<<1),21);
      op='jal';nextPC=target(pc+imm);result=pc+4;
    } else if (opcode === 0x67) {
      if(f3!==0)invalid();op='jalr';nextPC=target(((a+immI)>>>0)&0xfffffffe);result=pc+4;
    } else if (word === 0x00100073) {
      op='ebreak(host-stop)';this.halted=true;nextPC=pc;
    } else invalid();
    let write=null;
    if(result!==undefined && rd!==0){this.r[rd]=result>>>0;write={register:rd,value:this.r[rd]};}
    this.r[0]=0;this.pc=nextPC;this.steps++;
    return {pc,word,op,write,memory:memory||null,nextPC};
  }
  run(limit = 10000) {
    if(!Number.isInteger(limit)||limit<1)throw Error('Invalid step limit');
    const trace=[];
    while(!this.halted && trace.length<limit)trace.push(this.step());
    if(!this.halted)throw Error('Step limit exceeded');
    return trace;
  }
}
module.exports={CPU,hex,sx,fields};
