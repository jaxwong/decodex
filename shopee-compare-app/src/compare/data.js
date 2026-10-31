// Sample Shopee-style listings (illustrative specs, not real product data),
// cached sample AI extractor outputs, sample "generic LLM" output, and reviews.
// In the hackathon build these come from the backend / benchmark data files.

export const LISTINGS = {
  A:{short:'UGREEN Nexode',color:'#2563eb',shop:'UGREEN Official Store',
     title:'UGREEN Nexode Pin Sạc Dự Phòng 20000mAh 100W Sạc Nhanh PD Cho Laptop',
     variants:[{id:'a1',label:'100W Đen',price:1290000},{id:'a2',label:'130W Đen',price:1690000},{id:'a3',label:'100W + Cáp C-C',price:1390000},{id:'a4',label:'130W + Cáp C-C',price:1790000}],
     attrs:{'Thương hiệu':'UGREEN','Dung lượng':'20000mAh','Bảo hành':'24 tháng'},
     desc:['Pin sạc dự phòng UGREEN Nexode dung lượng 20000mAh, sạc được laptop, MacBook, điện thoại.',
           'Phiên bản 100W (PB720): cổng USB-C1/C2 maximum output 100W.',
           'Phiên bản 130W (PB730): tổng công suất tối đa 130W.',
           '2 cổng USB-C + 1 cổng USB-A.',
           'Trọng lượng bản 100W: 420g. Bản 130W: 498g.',
           'Sạc vào tối đa 65W qua USB-C.',
           'Phiên bản kèm cáp: tặng cáp USB-C to USB-C 100W dài 0.5m.',
           'Bảo hành chính hãng 24 tháng, 1 đổi 1 trong 30 ngày.']},
  B:{short:'Anker 20K 87W',color:'#0f766e',shop:'Anker Vietnam',
     title:'Anker Pin Sạc Dự Phòng 20K 87W Cho Laptop A1383',
     variants:[{id:'b1',label:'A1383 Đen',price:1590000},{id:'b2',label:'A1383 Trắng',price:1590000}],
     attrs:{'Thương hiệu':'Anker','Model':'A1383','Bảo hành':'24 tháng'},
     desc:['Anker PowerCore III, dung lượng 20Ah.',
           'Công suất đầu ra tối đa 87W qua cổng USB-C, đủ sạc MacBook Pro 14.',
           '2 cổng USB-C, 1 cổng USB-A.',
           'Khối lượng: 0.35kg.',
           'Sạc vào 60W.',
           'Trong hộp: pin sạc, túi đựng, hướng dẫn sử dụng.',
           'Bảo hành 2 năm.']},
  C:{short:'Baseus Blade',color:'#7c3aed',shop:'Baseus Gia Re 88',
     title:'BASEUS Pin Sạc Dự Phòng 20000mAh 65W/100W PD Sạc Nhanh Bảo Hành 24 Tháng',
     variants:[{id:'c1',label:'65W',price:690000},{id:'c2',label:'100W',price:890000},{id:'c3',label:'100W + Cáp',price:990000}],
     attrs:{'Thương hiệu':'Baseus','Dung lượng':'20000mAh'},
     desc:['SIÊU SẠC NHANH!!! Pin dự phòng Baseus Blade 20000mAh mỏng nhẹ.',
           'Bản 65W: sạc nhanh laptop 65W. Bản 100W: công suất tối đa 100W.',
           'Cổng: 2 x USB-C, 2 x USB-A.',
           'Bản 100W + Cáp tặng kèm cáp C-C 100W.',
           'Sạc vào: 65W (bản 100W), 30W (bản 65W).',
           'Bảo hành 12 tháng từ shop.']},
  D:{short:'Xiaomi Redmi',color:'#ea580c',shop:'Xiaomi Store VN',
     title:'Xiaomi Redmi Pin Sạc Dự Phòng 20000mAh 22.5W Sạc Nhanh',
     variants:[{id:'d1',label:'Đen',price:390000},{id:'d2',label:'Trắng',price:390000}],
     attrs:{'Thương hiệu':'Xiaomi'},
     desc:['Pin sạc dự phòng Xiaomi Redmi dung lượng 20000mAh, sạc nhanh 22.5W.',
           'Cổng: 1 USB-C, 2 USB-A.',
           'Trọng lượng 430 g.',
           'Sạc vào tối đa 18W.',
           'Tặng kèm cáp USB-A to USB-C.',
           'Bảo hành 6 tháng.']}
};

/* Cached sample AI extractor output (what the model returns: raw claims + quotes; never final values) */
const C = (raw,src,quote)=>({raw,src,quote});
export const AI_BASE = {
 'A:a1':{variant:{label:'100W Đen',model:'PB720',bundle:'Power bank only',confidence:.97,quotes:[{src:'variant',quote:'100W Đen'},{src:'desc:2',quote:'Phiên bản 100W (PB720)'}]},
   fields:{capacity_mah:{confidence:.98,claims:[C('20000mAh','title','20000mAh'),C('20000mAh','attr:Dung lượng','20000mAh')]},
     max_output_w:{confidence:.96,claims:[C('100W','desc:2','maximum output 100W'),C('100W','variant','100W')]},
     max_input_w:{confidence:.9,claims:[C('65W','desc:6','Sạc vào tối đa 65W')]},
     usbc_ports:{confidence:.93,claims:[C('2','desc:4','2 cổng USB-C')]},
     weight_g:{confidence:.95,claims:[C('420g','desc:5','Trọng lượng bản 100W: 420g')]},
     cable_included:{confidence:.82,claims:[C('no','desc:7','Phiên bản kèm cáp: tặng cáp USB-C to USB-C')]},
     warranty_months:{confidence:.97,claims:[C('24 tháng','attr:Bảo hành','24 tháng'),C('24 tháng','desc:8','Bảo hành chính hãng 24 tháng')]}}},
 'A:a2':{variant:{label:'130W Đen',model:'PB730',bundle:'Power bank only',confidence:.96,quotes:[{src:'variant',quote:'130W Đen'},{src:'desc:3',quote:'Phiên bản 130W (PB730)'}]},
   fields:{capacity_mah:{confidence:.98,claims:[C('20000mAh','title','20000mAh')]},
     max_output_w:{confidence:.95,claims:[C('130W','desc:3','tổng công suất tối đa 130W'),C('130W','variant','130W')]},
     max_input_w:{confidence:.9,claims:[C('65W','desc:6','Sạc vào tối đa 65W')]},
     usbc_ports:{confidence:.93,claims:[C('2','desc:4','2 cổng USB-C')]},
     weight_g:{confidence:.94,claims:[C('498g','desc:5','Bản 130W: 498g')]},
     cable_included:{confidence:.82,claims:[C('no','desc:7','Phiên bản kèm cáp: tặng cáp USB-C to USB-C')]},
     warranty_months:{confidence:.97,claims:[C('24 tháng','attr:Bảo hành','24 tháng'),C('24 tháng','desc:8','Bảo hành chính hãng 24 tháng')]}}},
 'B:b1':{variant:{label:'A1383 Đen',model:'A1383',bundle:'Power bank + pouch',confidence:.95,quotes:[{src:'variant',quote:'A1383 Đen'},{src:'attr:Model',quote:'A1383'}]},
   fields:{capacity_mah:{confidence:.94,claims:[C('20K','title','Pin Sạc Dự Phòng 20K'),C('20Ah','desc:1','dung lượng 20Ah')]},
     max_output_w:{confidence:.96,claims:[C('87W','title','87W'),C('87W','desc:2','Công suất đầu ra tối đa 87W')]},
     max_input_w:{confidence:.9,claims:[C('60W','desc:5','Sạc vào 60W')]},
     usbc_ports:{confidence:.93,claims:[C('2','desc:3','2 cổng USB-C')]},
     weight_g:{confidence:.95,claims:[C('0.35kg','desc:4','Khối lượng: 0.35kg')]},
     cable_included:{confidence:.86,claims:[C('no','desc:6','Trong hộp: pin sạc, túi đựng, hướng dẫn sử dụng')]},
     warranty_months:{confidence:.96,claims:[C('24 tháng','attr:Bảo hành','24 tháng'),C('2 năm','desc:7','Bảo hành 2 năm')]}}},
 'C:c2':{variant:{label:'100W',model:null,bundle:'Power bank only',confidence:.9,quotes:[{src:'variant',quote:'100W'},{src:'desc:2',quote:'Bản 100W: công suất tối đa 100W'}]},
   fields:{capacity_mah:{confidence:.97,claims:[C('20000mAh','title','20000mAh'),C('20000mAh','desc:1','Baseus Blade 20000mAh')]},
     max_output_w:{confidence:.93,claims:[C('100W','desc:2','Bản 100W: công suất tối đa 100W'),C('100W','variant','100W')]},
     max_input_w:{confidence:.88,claims:[C('65W','desc:5','65W (bản 100W)')]},
     usbc_ports:{confidence:.92,claims:[C('2','desc:3','2 x USB-C')]},
     weight_g:{confidence:.71,claims:[C('350g','desc:1','mỏng nhẹ chỉ 350g')]},  /* hallucinated quote → code rejects */
     cable_included:{confidence:.8,claims:[C('no','desc:4','Bản 100W + Cáp tặng kèm cáp C-C')]},
     warranty_months:{confidence:.95,claims:[C('24 Tháng','title','Bảo Hành 24 Tháng'),C('12 tháng','desc:6','Bảo hành 12 tháng từ shop')]}}},
 'C:c1':{variant:{label:'65W',model:null,bundle:'Power bank only',confidence:.9,quotes:[{src:'variant',quote:'65W'},{src:'desc:2',quote:'Bản 65W: sạc nhanh laptop 65W'}]},
   fields:{capacity_mah:{confidence:.97,claims:[C('20000mAh','title','20000mAh')]},
     max_output_w:{confidence:.92,claims:[C('65W','desc:2','Bản 65W: sạc nhanh laptop 65W'),C('65W','variant','65W')]},
     max_input_w:{confidence:.88,claims:[C('30W','desc:5','30W (bản 65W)')]},
     usbc_ports:{confidence:.92,claims:[C('2','desc:3','2 x USB-C')]},
     weight_g:{confidence:0,claims:[]},
     cable_included:{confidence:.8,claims:[C('no','desc:4','Bản 100W + Cáp tặng kèm cáp C-C')]},
     warranty_months:{confidence:.95,claims:[C('24 Tháng','title','Bảo Hành 24 Tháng'),C('12 tháng','desc:6','Bảo hành 12 tháng từ shop')]}}},
 'D:d1':{variant:{label:'Đen',model:null,bundle:'Power bank + USB-A to C cable',confidence:.92,quotes:[{src:'variant',quote:'Đen'}]},
   fields:{capacity_mah:{confidence:.98,claims:[C('20000mAh','title','20000mAh')]},
     max_output_w:{confidence:.93,claims:[C('22.5W','desc:1','sạc nhanh 22.5W'),C('22.5W','title','22.5W')]},
     max_input_w:{confidence:.9,claims:[C('18W','desc:4','Sạc vào tối đa 18W')]},
     usbc_ports:{confidence:.9,claims:[C('1','desc:2','1 USB-C')]},
     weight_g:{confidence:.95,claims:[C('430 g','desc:3','Trọng lượng 430 g')]},
     cable_included:{confidence:.9,claims:[C('yes','desc:5','Tặng kèm cáp USB-A to USB-C')]},
     warranty_months:{confidence:.96,claims:[C('6 tháng','desc:6','Bảo hành 6 tháng')]}}}
};
function derive(base, label, patch){const o=JSON.parse(JSON.stringify(AI_BASE[base]));o.variant.label=label;o.variant.quotes[0]={src:'variant',quote:label};if(patch)patch(o);return o}
const cableYes=(q)=>o=>{o.variant.bundle='Power bank + USB-C cable';o.fields.cable_included={confidence:.9,claims:[C('yes','desc:'+q[0],q[1])]}};
AI_BASE['A:a3']=derive('A:a1','100W + Cáp C-C',cableYes([7,'tặng cáp USB-C to USB-C 100W']));
AI_BASE['A:a4']=derive('A:a2','130W + Cáp C-C',cableYes([7,'tặng cáp USB-C to USB-C 100W']));
AI_BASE['B:b2']=derive('B:b1','A1383 Trắng');
AI_BASE['C:c3']=derive('C:c2','100W + Cáp',cableYes([4,'Bản 100W + Cáp tặng kèm cáp C-C 100W']));
AI_BASE['D:d2']=derive('D:d1','Trắng');

/* Sample "generic LLM" output — no evidence contract (for the comparison tab) */
export const GENERIC={
 'A:a1':{capacity_mah:'20,000 mAh',max_output_w:'130 W',max_input_w:'65 W',usbc_ports:'2',weight_g:'420 g',cable_included:'Yes',warranty_months:'24 months'},
 'B:b1':{capacity_mah:'20,000 mAh',max_output_w:'87 W',max_input_w:'60 W',usbc_ports:'2',weight_g:'350 g',cable_included:'Yes',warranty_months:'24 months'},
 'C:c2':{capacity_mah:'20,000 mAh',max_output_w:'100 W',max_input_w:'65 W',usbc_ports:'2',weight_g:'320 g',cable_included:'Yes',warranty_months:'24 months'},
 'D:d1':{capacity_mah:'20,000 mAh',max_output_w:'22.5 W',max_input_w:'18 W',usbc_ports:'1',weight_g:'430 g',cable_included:'Yes',warranty_months:'12 months'}
};

/* Reviews: AI tags each review (cached sample); code does all counting */
export const TOPICS={hot:{label:'Runs hot while charging'},slower:{label:'Charges slower than advertised',disputes:'max_output_w'},
  warranty12:{label:'Shop only honours 12-month warranty',disputes:'warranty_months'},heavy:{label:'Heavier than expected',disputes:'weight_g'},
  light:{label:'Light / easy to carry'},laptop_ok:{label:'Charges laptop fine'},solid:{label:'Solid build quality'},no_cable:{label:'No cable in the box'}};
export const REVIEWS={
 A:[['Sạc MacBook Air rất ổn, máy hơi ấm.',['laptop_ok','hot']],['Hàng chắc chắn, đóng gói kỹ.',['solid']],['Nặng hơn mình nghĩ nhưng ok.',['heavy']],['Sạc laptop Dell nhanh.',['laptop_ok']],['Dùng 2 tháng vẫn tốt.',['solid']],['Hơi nóng khi sạc 2 máy cùng lúc.',['hot']],['Giao nhanh, hàng chính hãng.',[]],['Sạc đầy pin hơi lâu.',[]]],
 B:[['Nhẹ, bỏ balo tiện lắm.',['light']],['Sạc MacBook Pro 14 ngon.',['laptop_ok']],['Không có cáp đi kèm, phải mua thêm.',['no_cable']],['Vỏ chắc, cầm đầm tay.',['solid']],['Nhỏ gọn hơn mong đợi.',['light']],['Ok trong tầm giá.',[]],['Hộp không có cáp nhé mọi người.',['no_cable']],['Sạc laptop được, máy mát.',['laptop_ok']]],
 C:[['Đo bằng đồng hồ chỉ được khoảng 60W, không tới 100W.',['slower']],['Sạc laptop chậm, không như quảng cáo 100W.',['slower','laptop_ok']],['Nóng ran khi sạc laptop.',['hot']],['Giá rẻ, mỏng nhẹ.',['light']],['Shop nói bảo hành chỉ 12 tháng chứ không phải 24.',['warranty12']],['Pin nóng quá.',['hot']],['Ổn trong tầm giá.',[]],['Đo thực tế ~65W thôi.',['slower']],['Hỏi shop thì bảo hành 12 tháng.',['warranty12']]],
 D:[['Rẻ mà dùng ổn.',[]],['Nặng tay.',['heavy']],['Sạc điện thoại nhanh.',[]],['Có cáp kèm theo, tiện.',[]],['Không sạc được laptop.',[]],['Hơi to.',['heavy']]]
};

