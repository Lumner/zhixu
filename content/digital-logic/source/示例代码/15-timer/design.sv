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
