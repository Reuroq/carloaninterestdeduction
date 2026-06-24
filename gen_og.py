"""OG/social image for the car-loan deduction site (gpt-image-2). Clean, trustworthy, no fake IRS marks."""
import os, base64
from openai import OpenAI
key=os.environ.get("OPENAI_API_KEY","")
if len(key)<40:
    for p in (r"C:\Users\dwayn\OneDrive\Desktop\WorkShield\.env",):
        try:
            for line in open(p,encoding="utf-8",errors="replace"):
                if line.strip().startswith("OPENAI_API_KEY") and "=" in line: key=line.split("=",1)[1].strip().strip('"').strip("'")
        except FileNotFoundError: pass
client=OpenAI(api_key=key)
OUT=r"C:\Users\dwayn\OneDrive\Desktop\CarLoanDeduction\img"; os.makedirs(OUT,exist_ok=True)
prompt=("A clean, premium editorial illustration for a personal-finance website hero/social card: a modern new car and a "
        "stylized tax/savings motif (a percent symbol and an upward coin/savings arc) on a deep navy-to-teal gradient "
        "background, soft studio lighting, lots of negative space on the left for a headline, flat modern vector style, "
        "trustworthy and professional. NO text, NO words, NO logos, NO government seals, NO IRS marks. 16:9.")
r=client.images.generate(model="gpt-image-2",prompt=prompt,size="1536x1024",quality="high")
open(os.path.join(OUT,"og.png"),"wb").write(base64.b64decode(r.data[0].b64_json))
print("saved og.png")
