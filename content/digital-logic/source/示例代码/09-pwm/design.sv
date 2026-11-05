module pwm8(input logic clk,rst,input logic [3:0] duty,output logic pwm);
  logic [2:0] phase;
  always_ff @(posedge clk) begin
    if(rst) phase<=3'b0;
    else phase<=phase+1'b1;
  end
  assign pwm=!rst && ({1'b0,phase}<duty);
endmodule
