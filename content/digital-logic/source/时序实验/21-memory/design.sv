module ram4(
  input logic clk,we,
  input logic [1:0] addr,
  input logic [7:0] din,
  output logic [7:0] dout
);
  logic [7:0] mem[0:3];
  always_ff @(posedge clk) begin
    if (we) mem[addr] <= din;
    dout <= mem[addr];
  end
endmodule

module rom4(input logic [1:0] addr,output logic [7:0] value);
  logic [7:0] contents[0:3];
  initial $readmemh("rom.hex",contents,0,3);
  assign value=contents[addr];
endmodule
