`timescale 1ns/1ps
module tb;
  logic [3:0] d0, d1, d2, d3, req;
  logic [1:0] sel, index;
  logic en, valid;
  logic [3:0] y, decoded;
  logic [3:0] expected_y, expected_decoded;
  logic expected_valid;
  logic [1:0] expected_index;
  integer count;
  routing_demo dut(.d0(d0), .d1(d1), .d2(d2), .d3(d3),
    .sel(sel), .en(en), .req(req), .y(y), .decoded(decoded),
    .valid(valid), .index(index));

  initial begin
    count = 0;
    for (int pattern=0; pattern<16; pattern++) begin
      d0 = pattern[3:0];
      d1 = ~d0;
      d2 = {d0[1:0], d0[3:2]};
      d3 = 4'b0001;
      for (int s=0; s<4; s++) begin
        for (int e=0; e<2; e++) begin
          for (int r=0; r<16; r++) begin
            sel = s[1:0]; en = e[0]; req = r[3:0];
            case (s)
              0: expected_y = d0;
              1: expected_y = d1;
              2: expected_y = d2;
              3: expected_y = d3;
            endcase
            expected_decoded = 4'b0000;
            if (e == 1) expected_decoded[s] = 1'b1;
            expected_valid = (r != 0);
            expected_index = 2'd0;
            for (int k=0; k<4; k++) begin
              if (req[k]) expected_index = k[1:0];
            end
            #1;
            if ({y,decoded,valid,index} !==
                {expected_y,expected_decoded,expected_valid,expected_index})
              $fatal(1, "routing p=%0d sel=%0d en=%0d req=%b actual=%b/%b/%b/%0d expected=%b/%b/%b/%0d",
                pattern,s,e,req,y,decoded,valid,index,
                expected_y,expected_decoded,expected_valid,expected_index);
            count = count + 1;
          end
        end
      end
    end
    $display("PASS routing: %0d selected-data/control cases", count);
    $finish;
  end
  initial begin #5000; $fatal(1, "routing timeout"); end
endmodule
