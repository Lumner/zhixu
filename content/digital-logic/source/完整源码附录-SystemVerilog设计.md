# 完整源码附录：15组 SystemVerilog 设计

本页汇集与下载包一致的设计文件，便于网页阅读和复制。测试平台、接口解释及运行方式见各组示例说明。修改时以示例目录的design.sv为准，更新附录后重新打包。这里每个代码块都是对应实验的完整设计，模块应按实验独立编译。

## 01-gates 第一个逻辑门实验

输入a、b均为一位，输出y_and与y_xor分别表示与、异或。两个assign持续存在，输入变化时组合结果重新计算，不使用时钟。

[示例说明](示例代码/01-gates/README.md) · [测试平台](示例代码/01-gates/tb.sv)

```systemverilog
module gates(input logic a,b, output logic y_and,y_xor);
  assign y_and=a&b;
  assign y_xor=a^b;
endmodule
```

## 02-bits 位向量与奇偶实验

data是8位无符号向量，swapped将低四位放在高端、高四位放在低端；odd归约异或统计1的个数奇偶。

[示例说明](示例代码/02-bits/README.md) · [测试平台](示例代码/02-bits/tb.sv)

```systemverilog
module bits_demo(input logic [7:0] data, output logic [7:0] swapped,
                 output logic odd);
  assign swapped={data[3:0],data[7:4]};
  assign odd=^data;
endmodule
```

## 03-mux 二选一组合电路

a、b各4位，sel=0取a，sel=1取b。always_comb每条分支都给y赋值，因此不保存过去的值。

[示例说明](示例代码/03-mux/README.md) · [测试平台](示例代码/03-mux/tb.sv)

```systemverilog
module mux2(input logic [3:0] a,b, input logic sel, output logic [3:0] y);
  always_comb begin
    if(sel) y=b;
    else y=a;
  end
endmodule
```

## 04-decoder 译码与使能

en有效时，sel=0/1/2/3分别使y的第0/1/2/3位为1；en=0输出0000。默认赋值覆盖禁用情形。

[示例说明](示例代码/04-decoder/README.md) · [测试平台](示例代码/04-decoder/tb.sv)

```systemverilog
module decoder(input logic en, input logic [1:0] sel, output logic [3:0] y);
  always_comb begin
    y=4'b0;
    if(en) begin
      case(sel)
        2'd0: y=4'b0001;
        2'd1: y=4'b0010;
        2'd2: y=4'b0100;
        2'd3: y=4'b1000;
        default: y=4'b0;
      endcase
    end
  end
endmodule
```

## 05-alu 算术逻辑单元

4位a/b，op00加、01减、10与、11异或。宽结果5位保存进位；减法carry为无借位；overflow表示补码结果超出范围。

[示例说明](示例代码/05-alu/README.md) · [测试平台](示例代码/05-alu/tb.sv)

```systemverilog
module alu(input logic [3:0] a,b, input logic [1:0] op,
           output logic [3:0] y, output logic carry,overflow,zero);
  logic [4:0] wide;
  always_comb begin
    y=4'b0; wide=5'b0; carry=1'b0; overflow=1'b0;
    case(op)
      2'b00: begin
        wide={1'b0,a}+{1'b0,b}; y=wide[3:0]; carry=wide[4];
        overflow=~(a[3]^b[3]) & (y[3]^a[3]);
      end
      2'b01: begin
        wide={1'b0,a}+{1'b0,~b}+5'd1; y=wide[3:0]; carry=wide[4];
        overflow=(a[3]^b[3]) & (y[3]^a[3]);
      end
      2'b10: y=a&b;
      2'b11: y=a^b;
      default: y=4'b0;
    endcase
  end
  assign zero=(y==4'b0);
endmodule
```

## 06-parity 参数化奇偶检测

WIDTH在展开时固定，合法范围至少1。odd=1表示数据中有奇数个1。WIDTH改变的是硬件信号数量。

[示例说明](示例代码/06-parity/README.md) · [测试平台](示例代码/06-parity/tb.sv)

```systemverilog
module parity #(parameter integer WIDTH=8)(input logic [WIDTH-1:0] data,
                                           output logic odd);
  assign odd=^data;
endmodule
```

## 07-register 同步寄存器

clk上升沿采样。rst高有效同步且优先，en=1加载d，否则q保持；数据8位。

[示例说明](示例代码/07-register/README.md) · [测试平台](示例代码/07-register/tb.sv)

```systemverilog
module data_reg(input logic clk,rst,en,input logic [7:0] d,output logic [7:0] q);
  always_ff @(posedge clk) begin
    if(rst) q<=8'b0;
    else if(en) q<=d;
  end
endmodule
```

## 08-tick 节拍使能发生器

DIV≥1，en有效时计数；count为DIV−1时tick高，消费者在接下来的共同上升沿使用它。en=0保存部分周期。

[示例说明](示例代码/08-tick/README.md) · [测试平台](示例代码/08-tick/tb.sv)

```systemverilog
module tick_gen #(parameter integer DIV=4)(input logic clk,rst,en,output logic tick);
  localparam integer CW=(DIV<=1)?1:$clog2(DIV);
  logic [CW-1:0] count;
  assign tick=en && !rst && (count==DIV-1);
  always_ff @(posedge clk) begin
    if(rst) count<='0;
    else if(en) begin
      if(tick) count<='0;
      else count<=count+1'b1;
    end
  end
endmodule
```

## 09-pwm 八拍PWM

phase为3位每拍回绕，pwm由phase与4位duty比较。duty0全低，8及以上全高；周期中修改duty立即影响输出。

[示例说明](示例代码/09-pwm/README.md) · [测试平台](示例代码/09-pwm/tb.sv)

```systemverilog
module pwm8(input logic clk,rst,input logic [3:0] duty,output logic pwm);
  logic [2:0] phase;
  always_ff @(posedge clk) begin
    if(rst) phase<=3'b0;
    else phase<=phase+1'b1;
  end
  assign pwm=!rst && ({1'b0,phase}<duty);
endmodule
```

## 10-memory 同步读写存储器

16个8位元素，4位地址。写入与读取均在上升沿；同沿同址读写返回旧值，下一沿才可读到新值。未写区域不保证零。

[示例说明](示例代码/10-memory/README.md) · [测试平台](示例代码/10-memory/tb.sv)

```systemverilog
module memory(input logic clk,we,input logic [3:0] addr,
              input logic [7:0] din,output logic [7:0] dout);
  logic [7:0] mem[0:15];
  always_ff @(posedge clk) begin
    if(we) mem[addr]<=din;
    dout<=mem[addr];
  end
endmodule
```

## 11-fsm 两状态控制器

复位RED，advance每次有效使RED/GREEN切换，输出只依赖当前状态，属于Moore型。state保存，next组合计算。

[示例说明](示例代码/11-fsm/README.md) · [测试平台](示例代码/11-fsm/tb.sv)

```systemverilog
module traffic(input logic clk,rst,advance,output logic red,green);
  typedef enum logic {RED,GREEN} state_t;
  state_t state,next;
  always_comb begin
    next=state;
    case(state)
      RED: if(advance) next=GREEN;
      GREEN: if(advance) next=RED;
      default: next=RED;
    endcase
  end
  always_ff @(posedge clk) begin
    if(rst) state<=RED;
    else state<=next;
  end
  assign red=(state==RED);
  assign green=(state==GREEN);
endmodule
```

## 12-fifo 同步四项FIFO

宽8、深4，按沿前empty/full决定是否接受。空时同时读写只写，满时同时读写只读；成功读取后dout更新并保持。

[示例说明](示例代码/12-fifo/README.md) · [测试平台](示例代码/12-fifo/tb.sv)

```systemverilog
module fifo4(input logic clk,rst,wr_en,rd_en,input logic [7:0] din,
             output logic [7:0] dout,output logic full,empty);
  logic [7:0] mem[0:3];
  logic [1:0] wp,rp;
  logic [2:0] count;
  logic push,pop;
  assign full=(count==4);
  assign empty=(count==0);
  assign push=wr_en && !full;
  assign pop=rd_en && !empty;
  always_ff @(posedge clk) begin
    if(rst) begin wp<=0; rp<=0; count<=0; dout<=0; end
    else begin
      if(push) begin mem[wp]<=din; wp<=wp+1'b1; end
      if(pop) begin dout<=mem[rp]; rp<=rp+1'b1; end
      case({push,pop})
        2'b10: count<=count+1'b1;
        2'b01: count<=count-1'b1;
        default: count<=count;
      endcase
    end
  end
endmodule
```

## 13-uart 8N1串口发送

start在空闲上升沿被接受并锁存data，忙时请求忽略。起始0、低位先发、停止1；每位持续CLKS_PER_BIT拍。

[示例说明](示例代码/13-uart/README.md) · [测试平台](示例代码/13-uart/tb.sv)

```systemverilog
module uart_tx #(parameter integer CLKS_PER_BIT=4)(
  input logic clk,rst,start,input logic [7:0] data,
  output logic tx,busy
);
  localparam integer CW=(CLKS_PER_BIT<=1)?1:$clog2(CLKS_PER_BIT);
  logic [CW-1:0] count;
  logic [9:0] frame;
  logic [3:0] bit_index;
  always_ff @(posedge clk) begin
    if(rst) begin tx<=1; busy<=0; count<=0; frame<='1; bit_index<=0; end
    else if(!busy) begin
      tx<=1;
      if(start) begin
        frame<={1'b1,data,1'b0}; tx<=0; busy<=1; count<=0; bit_index<=0;
      end
    end else if(count==CLKS_PER_BIT-1) begin
      count<=0;
      if(bit_index==9) begin busy<=0; tx<=1; end
      else begin
        frame<={1'b1,frame[9:1]}; tx<=frame[1]; bit_index<=bit_index+1'b1;
      end
    end else count<=count+1'b1;
  end
endmodule
```

## 14-button 同步消抖与单拍事件

async_in先两级同步，再连续STABLE_CYCLES次采样接受新电平；接受高电平时pressed只高一周期。rst假定已满足本地时钟域。

[示例说明](示例代码/14-button/README.md) · [测试平台](示例代码/14-button/tb.sv)

```systemverilog
module button_filter #(parameter integer STABLE_CYCLES=3)(
  input logic clk,rst,async_in,output logic stable,pressed
);
  localparam integer CW=(STABLE_CYCLES<=1)?1:$clog2(STABLE_CYCLES);
  logic sync1,sync2;
  logic [CW-1:0] count;
  // FPGA工程中还需按器件流程声明同步器属性并检查CDC/布局。
  always_ff @(posedge clk) begin
    if(rst) begin sync1<=0; sync2<=0; stable<=0; pressed<=0; count<=0; end
    else begin
      sync1<=async_in; sync2<=sync1; pressed<=0;
      if(sync2==stable) count<=0;
      else if(count==STABLE_CYCLES-1) begin
        stable<=sync2; pressed<=sync2; count<=0;
      end else count<=count+1'b1;
    end
  end
endmodule
```

## 15-timer 可启动暂停清零计时器

控制为同步高有效单拍。clear/rst最高，toggle次之且该沿不推进时间；暂停保留部分秒，seconds从0到59循环。

[示例说明](示例代码/15-timer/README.md) · [测试平台](示例代码/15-timer/tb.sv)

```systemverilog
module timer_core #(parameter integer CLKS_PER_SEC=3)(
  input logic clk,rst,toggle,clear,
  output logic running,output logic [5:0] seconds
);
  localparam integer CW=(CLKS_PER_SEC<=1)?1:$clog2(CLKS_PER_SEC);
  logic [CW-1:0] phase;
  always_ff @(posedge clk) begin
    if(rst || clear) begin running<=0; phase<=0; seconds<=0; end
    else if(toggle) running<=!running;
    else if(running) begin
      if(phase==CLKS_PER_SEC-1) begin
        phase<=0;
        if(seconds==59) seconds<=0;
        else seconds<=seconds+1'b1;
      end else phase<=phase+1'b1;
    end
  end
endmodule
```
