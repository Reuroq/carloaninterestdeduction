/* Car Loan Interest Deduction — eligibility checker + savings calculator.
   All logic from the verified rules (OBBBA / IRS proposed regs, as of June 2026). Client-side only. */
(function(){
  "use strict";
  var $=function(s,r){return (r||document).querySelector(s);};
  var fmt=function(n){return "$"+Math.round(n).toLocaleString("en-US");};
  function seg(el,cb){
    el.querySelectorAll("button").forEach(function(b){
      b.addEventListener("click",function(){
        el.querySelectorAll("button").forEach(function(x){x.classList.remove("on");});
        b.classList.add("on"); el.dataset.val=b.dataset.v; if(cb)cb(b.dataset.v);
      });
    });
  }

  /* ---------------- ELIGIBILITY CHECKER ---------------- */
  var checker=$("#checker");
  if(checker){
    // each question: id, text, disqualifying answer logic
    var QS=[
      {id:"new",  q:"Is this a <b>brand-new</b> vehicle whose first use begins with you?",
       opts:[["yes","Yes, new"],["no","No, used"]], bad:function(v){return v==="no";},
       why:"Used vehicles never qualify &mdash; the &lsquo;original use&rsquo; must begin with you."},
      {id:"lease", q:"Is it a <b>lease</b>?",
       opts:[["no","No, I'm buying"],["yes","Yes, a lease"]], bad:function(v){return v==="yes";},
       why:"Lease payments are excluded. (A car bought at lease-end is &lsquo;used&rsquo; and also doesn't qualify.)"},
      {id:"usa", q:"Was the vehicle's <b>final assembly in the U.S.</b>?",
       opts:[["yes","Yes"],["no","No"],["unsure","Not sure"]], bad:function(v){return v==="no";},
       why:"U.S. final assembly is required. Check the plant in the VIN or the window sticker.",
       hint:'Check free at the <a href="https://www.nhtsa.gov/vin-decoder" target="_blank" rel="nofollow noopener">NHTSA VIN Decoder</a> &mdash; the badge/brand does not decide it.'},
      {id:"date", q:"Was the <b>loan taken out after December 31, 2024</b>?",
       opts:[["yes","Yes, in 2025+"],["no","No, earlier"]], bad:function(v){return v==="no";},
       why:"The loan must be originated after Dec 31, 2024. A pre-2025 loan never qualifies, even for interest paid now."},
      {id:"lien", q:"Is the loan <b>secured by a first lien</b> on that vehicle?",
       opts:[["yes","Yes"],["no","No / unsecured"]], bad:function(v){return v==="no";},
       why:"Must be a first-lien loan on the vehicle (e.g. a personal loan or a HELOC used to buy it does not qualify)."},
      {id:"use", q:"Is the vehicle <b>more than 50% personal use</b> (commuting counts as personal)?",
       opts:[["yes","Yes, personal"],["no","No, mostly business"]], bad:function(v){return v==="no";},
       why:"It must be primarily personal-use. Business-vehicle interest is deducted elsewhere (Schedule C/E/F)."},
      {id:"type", q:"Is it a car, minivan, van, SUV, pickup, or motorcycle <b>under 14,000 lbs GVWR</b>?",
       opts:[["yes","Yes"],["no","No"]], bad:function(v){return v==="no";},
       why:"Qualifying types are car/minivan/van/SUV/pickup/motorcycle under 14,000 lbs. (EVs qualify if U.S.-assembled; RVs do not.)"},
      {id:"rel", q:"Is the loan from a <b>relative or a business you control</b>?",
       opts:[["no","No, a normal lender"],["yes","Yes, related party"]], bad:function(v){return v==="yes";},
       why:"Loans from a related party (relative, or an entity you own/control) are excluded."}
    ];
    var box=$("#checker-qs"), out=$("#checker-out");
    QS.forEach(function(Q){
      var d=document.createElement("div"); d.className="q";
      var opts=Q.opts.map(function(o){return '<button data-v="'+o[0]+'">'+o[1]+'</button>';}).join("");
      d.innerHTML='<div class="qt">'+Q.q+'</div>'+(Q.hint?'<div class="hint muted small">'+Q.hint+'</div>':'')+
                  '<div class="seg" id="seg-'+Q.id+'">'+opts+'</div>';
      box.appendChild(d);
      seg($("#seg-"+Q.id,d),evaluate);
    });
    function evaluate(){
      var ans={},answered=0;
      QS.forEach(function(Q){var v=($("#seg-"+Q.id)||{}).dataset?$("#seg-"+Q.id).dataset.val:null; if(v){ans[Q.id]=v;answered++;}});
      if(answered<QS.length){ out.innerHTML='<p class="muted">Answer all questions for a verdict &mdash; '+answered+'/'+QS.length+' done.</p>'; return; }
      var fails=QS.filter(function(Q){return Q.bad(ans[Q.id]);});
      var unsure=ans.usa==="unsure";
      if(fails.length){
        out.innerHTML='<div class="verdict no"><h3>&#10007; Likely does NOT qualify</h3>'+
          '<p>Based on your answers, these rules aren&rsquo;t met:</p><ul>'+
          fails.map(function(Q){return "<li>"+Q.why+"</li>";}).join("")+'</ul></div>';
      } else if(unsure){
        out.innerHTML='<div class="verdict maybe"><h3>&#9888; Almost &mdash; confirm U.S. assembly</h3>'+
          '<p>Every other rule checks out. The one open item is U.S. final assembly &mdash; confirm it free at the '+
          '<a href="https://www.nhtsa.gov/vin-decoder" target="_blank" rel="nofollow noopener">NHTSA VIN Decoder</a>. '+
          'If it shows a U.S. plant, you likely qualify.</p>'+
          '<p><a class="btn alt" href="/savings-calculator.html">Estimate your deduction &rarr;</a></p></div>';
      } else {
        out.innerHTML='<div class="verdict yes"><h3>&#10003; You likely QUALIFY</h3>'+
          '<p>Your answers meet every core rule for the car-loan interest deduction. Next, see how much it&rsquo;s worth &mdash; '+
          'the benefit also depends on your income (it phases out) and how much interest you actually pay.</p>'+
          '<p><a class="btn alt" href="/savings-calculator.html">Estimate your deduction &rarr;</a></p></div>';
      }
      out.scrollIntoView({behavior:"smooth",block:"nearest"});
    }
  }

  /* ---------------- SAVINGS CALCULATOR ---------------- */
  var calc=$("#calc");
  if(calc){
    var filing="single", bracket="0.22";
    seg($("#calc-filing"),function(v){filing=v;run();});
    seg($("#calc-bracket"),function(v){bracket=v;run();});
    ["#calc-amount","#calc-apr","#calc-term","#calc-magi"].forEach(function(s){
      var el=$(s); if(el) el.addEventListener("input",run);
    });
    function firstYearInterest(P,apr,nMonths){
      var r=apr/100/12;
      if(r<=0) return 0;
      var pmt=P*r/(1-Math.pow(1+r,-nMonths));
      var bal=P,interest=0,m=Math.min(12,nMonths);
      for(var i=0;i<m;i++){var it=bal*r; interest+=it; bal-=(pmt-it);}
      return interest;
    }
    function run(){
      var P=parseFloat($("#calc-amount").value)||0;
      var apr=parseFloat($("#calc-apr").value)||0;
      var term=parseFloat($("#calc-term").value)||60;
      var magi=parseFloat($("#calc-magi").value)||0;
      var begin=filing==="mfj"?200000:100000, end=filing==="mfj"?250000:150000;
      var interest=firstYearInterest(P,apr,term);
      // phaseout reduces the $10,000 cap by $200 per full $1,000 over the threshold
      var over=Math.max(0,magi-begin);
      var cap=Math.max(0,10000-200*Math.floor(over/1000));
      var deduction=Math.max(0,Math.min(interest,cap));
      var savings=deduction*parseFloat(bracket);
      var phaseTxt = magi>=end ? "Fully phased out at this income." :
                     over>0 ? ("Cap reduced to "+fmt(cap)+" by the income phaseout.") :
                     "Below the income phaseout &mdash; full $10,000 cap.";
      $("#calc-out").innerHTML=
        '<div class="result">'+
          '<div class="kpi"><div class="l">First-year interest</div><div class="v">'+fmt(interest)+'</div></div>'+
          '<div class="kpi"><div class="l">Deductible amount</div><div class="v" style="color:var(--green)">'+fmt(deduction)+'</div></div>'+
          '<div class="kpi"><div class="l">Est. tax savings</div><div class="v" style="color:var(--navy)">'+fmt(savings)+'</div></div>'+
        '</div>'+
        '<p class="muted small">'+phaseTxt+' Tax savings &asymp; deduction &times; your '+(Math.round(parseFloat(bracket)*100))+'% marginal rate. '+
        'The deduction lowers taxable income &mdash; it is <b>not</b> a dollar-for-dollar credit. First-year interest is highest; it falls each year as the loan amortizes.</p>';
    }
    run();
  }
})();
