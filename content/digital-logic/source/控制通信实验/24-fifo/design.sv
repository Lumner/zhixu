module fifo4_demo(
  input logic clk,rst,wr_en,rd_en,
  input logic [7:0] din,
  output logic [7:0] dout,
  output logic full,empty,push,pop,
  output logic [2:0] level
);
  logic [7:0] mem[0:3];
  logic [1:0] wp,rp;
  assign full=(level==3'd4);
  assign empty=(level==3'd0);
  assign push=!rst && wr_en && !full;
  assign pop=!rst && rd_en && !empty;
  always_ff @(posedge clk) begin
    if (rst) begin wp<=0;rp<=0;level<=0;dout<=0;end
    else begin
      if (push) begin mem[wp]<=din;wp<=wp+1'b1;end
      if (pop) begin dout<=mem[rp];rp<=rp+1'b1;end
      case ({push,pop})
        2'b10: level<=level+1'b1;
        2'b01: level<=level-1'b1;
        default: level<=level;
      endcase
    end
  end
endmodule
