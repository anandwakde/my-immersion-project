"use node";

import { ConvexError, v } from "convex/values";
import { action, env } from "./_generated/server";
import { internal } from "./_generated/api";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  TextRun,
} from "docx";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

const NETLINK_LOGO_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAcgAAABcCAYAAADqISULAAAivElEQVR4Xu2didcUxb2G83fdexOT3CRXE6OJMYlmuS4R9z1R475vccM1osRdFFwQEYSIuCEKatxxARFRowLKjjeJse+87dfY81R1dXV19fTMfD3nPOfAN/Vbqqqr3unu6upvbNvxedIk22tCf95sH3KYJ/8/6rA/QqHfpmH8WDBObBivZaKN45Zg/kNTD/Z7LBinBLZL0zC+N6xnRb5hOIwMK1oV+vPCUtGhgzmPUu4+sF6h0G/TMH5MGCsmjNUyUcZxSzB3wvIDhf0eC8YpgW3SJIxdCdazIuMnkJZKDgXMj3nz+1GH9QqFfpuG8WPDeLFgnJapPY5bgnn7Qj+NwX6PBeOUwPo3BeNWhvWsSCeQg4J5FkG7NmFubcG8mF/R34tg+Sq2MWDMGDBGy9Qexy3BvH2hn8Zgv8eCcTxgG8SG8YJgPSvSCeSgYJ5F0K4tmFfblOVX9PciWJ7/bxrWpy703zK1x3FLMG9f6Kcx2O+xYJyKtNYeZbCeFekEchAwRxe0bQvm1Taxc6Mv/n8QsM3rQN8tU3sctwTzDoE+o8E+jwljBdB4/UNgPSvSCWRsmAfzK4P+2oJ5tU3svOiP/x8UbPdQ6Ldlao/jlmDeodBvbdjfsWG8cYH1rMj4CaSwVLQS9NcWzGtQMI/JQFt1Z9uHQr8tU3sMtwTnnxgwRhDs79gw3rjAelakcYH8ZOP2ZO4L65Lz5qxNDpy+MtntshXJNy94bSxQXVQn1e3BXh1VV9a/NpZOaxTGnyy0VX+2fyj02zJRxWGAUNxiwTiVYX/HhvHGBdazIo0J5GtrN6fCQVEZd1Rn1Z3tUQtLxzUGY08W2mwD9kEI9NkRBIUtJoxVCfZ3bBhvXGA9K9KIQE5d+IEhHJMNtQHbpRaWzmsExp0ssB0Iy8eG8apCfx1BUNRiw3jesL9jw3jjAutZkagCqTOnA6avNMRisqK2iH42mcfSobVhjMkC28EGbWLCWFWhv47KUMyagDG9YX/HhvHGAdYxgGgCuWzlxrG6vxgLtYnahu0VDUun1oL+JwtsB1/oJxT6rQr9dVSCQtYUjOsN+zs2jDfqsH6BRBFInSV14liM2qbRM8kiLB1uhXaTEbZJFegrFPqtAn11eEMRaxrG94L93QSMOcqwboFEEcjusmo5aiO220DIOpv/598nO2yXUOi3KvTnC/10eEHxGhTMoxT2d1Mw7qjCegVSWyC7BTn+RF+40xEPy+AIgn6rQn++0E+HFxSuQcE8SmF/NwXjNgFj+kI/RdCuBrUEUpcNKQIdblq51NpRjmVwBEG/VaE/X+inwwsK16BgHqWwv5uCcWPDeFWhP8LyNaklkJPxOce6qM3Yjh1DgGVwBEG/VaE/X+inwwsK16BgHqWwv5uCcWPCWKHQb2z/OYIFUrvGcPLv8KORHXc66mEZHEHQb1Xozxf66fCCwjUomEcp7O+mYNxYME5dmvY/QbBAavs4TvwdfmhbOrZnR8tYBkcQ9BsCffpAHx1eULgGBfMohf3dFIwbA8YYIYIFsru8Gk53mXUIsQyOIOg3FPotg/YdXlC4BgXzKIX93RSMWxf6HzGCBVKbdHPi7/BDbcf27GgZy+AIgn7rQN8uaNtRCkVrUDAPL9jfTcG4daH/ESNYILuNAcJR27E9O1rGMjiCoN+60H8RtBswnPz5/2GDojUomIc37O+mYNy60P+IESyQnPQ7qsH2rAIHXRG063BgGRxB0G9d6L8I2g0YHnujcAwy10HAHLxhfzcF49aF/keMTiBbgu3pCwdcGbTvKMAyOIKg37rQfxG0GzA87kbl+GO+TcP43rC/m4Jx60L/I0YnkC3B9vSBg60pGHfYiZK/ZXAEQb91of8iaDdA2P6E5YcJ5to0jO8F+7pJGLsu9D9idALZEmzPMjjQmobxhxXmHZy/ZXAEQb91of8iaDcg2O5F0G5YYJ5Nw/ilsJ+bhvHrQv8jRieQLcH2dMFB1hbMaxhgjrXytQyQStBfLBiHsPwAYZsXQbthgXk2CWN7wb4eBMyhDvQ9YnQC2RJszyI4yNqG+Q0a5sH8CO1LsQwSL+gHvLlyTXLq+dclvzzo5OR3x5yTTLv1/mTj5q1GuUIYh/9vCbZ3EbQbFphnUzCuNzzOBgXzCIV+R4xOIFuC7VkEB9qwwDxjw3ih0G9lLIMmheUcPPfiimSXH09J/mPXA/qQUG7aus0oPwqwncug/aD48KP1yd9eeStZsPiZZP6ip5NlL7yWrFy9Nvl00xajLHOOCWN5w+NuUDCPEOhzBOkEsiXYnkVwoIXwk//9Q/LDfY42OOLEi5Kt27Yb5X1474OPDX95Xnj5DaMuVWC8UOi3MhgwBx1zrlHXjPvnPWba99j34FMNccy4beZ8o3ybuOo3O1c/tnMZjNMUGz7bnMyasyg58Ohzku/seYjR3jvZ7cBkynHnJbfPmp+sWfvRTnvmHQvm6Y1l0h4IzKMq9DeidALZEmzPIjjQQthlj4PNCWKCG29/wCjvgyYV+sqz7G+vG3WJVZ8QmEcoex94klHXjLtn/9Uo/8n6z4xyef54zjWGTZu46jczVz+2bxmMExudFV505S3J9/Y6zMi7lJ5YnnT2VTuFkrnHgPl6Y5m0BwLzqAr9jSgjIZDfuej1ZM8r3zT4du/vLFsGfWTscqFZtknYnkVwoIXgEshv7n5Q8vLrKw2bMkZNIFe8tTq5+a65VvITfxkuAbEJ5JbeGbrrTEaTOm3axFW/YRXIhYufSf77pwHCCL77k0OTW+56KO0z5l8X5uyNZdIeCMyjKvQ3ooyEQB566zuJ7XP/858aZV1IBIs+e139llG+SdieRXCgheASSPGrQ05LNm3eatgVobx8BZK2bTFn/uNGjhm7/+pYo92LcAmITSDFhVfcbJQV3/zRQbUvRcfGVT/+kGAbu2CcGEjIrrzhLiPPupxy3rXBtx6KYO7eWCbtgcA8qkBfI8xIC+SXPY6/a41RvohOIIuZOm2GYWcjy6sTSJMigdSCkFPOvbav7Pf3Ojx58OEnjLJt46ofBVKwnYugXWWySWvi/1u370hOOPNKI8dYnHbBn3vxdhj1CMWojy+WSXsgMA9f6GfEGWmB1Gfdln8mu13+hmFjY5QEkgOsDj4C+Z8//F26wk/lmYuNTiBNbAKS55UVK5P75y5OFj72TLq6kt8PA1Xrx3YugnaVwcR168x5Rn6x0dkp61EXo15lWCbtgcFcfKCPEWfkBVKfha9uMmxsdALp5mcHnJis/3STkYuNTiBNbAIyalStH9u5CNpVJjdp6Z75t3Y3H5shP9rnmOTEs65Kpt8xJ3nq2ReTl157O1nw6NL0/3sfUFzPDN2ff2vVGqMudTDqVYZl0h4ozKcM2o84YyGQ+px2X/kLnDuBLOf8y28ycrHRCaSJTUBGjar1YzsXQbvKTExYn27ckm62wNyINmXQIx+Gnwl0/1LHhBbm0DbPcadebtSlDsyjFMukPVCYjwvajgFjI5CbdnyRrkalbZ5OIP14bMnzRj6kKYF8Z80HydLlryQPzHs8ueG22emltIcXLU2ef2lFOuGxvIvX31ydvLpiVYoeZ2GOGbv94qid5TJ05sA6i6oCIrSLDv1n/P3jDUb5MhtN7iy/cvX7yaLHlyV33PNw8pc7H0wefWJ5svq9D41yZVStH9t8xdvvGvn61LeUiQnr3rmPGnnl0Vmf2sCwL+Dp5S+Xjg/VifUUH6/7zKhfho7jfNnNW7f1xtUL6fF89fSZyV33LUxefWOVkY9Br85bt+1IjwedBd83d3EyrTcu9PymVu9qEwTlwYndB41h5p2RHjsqx3zAW6veM2wz0r6uGHftB58Y5bP6P7jgyXROeKD3w2Z5b375VD+ALP5jMjYCqc/TK7cYtnlGQSA5CGNQNgEQnVF99MmnRm55fAXSp07pw90PPJL85rDTDT959Gv/zIunpZOazwKKoGfiJtDKXtZZVBWQJmw+Xvd13yxZ9nJyzMmXps/ysZzQYiD9OLCJqg1XXFuu+fa+90G3eOmyZl2BPPT3Fxh+81QRxwzZ0E+e23vf89gSc3sTNstmaAFRVm7eI08ne+13glFG9ziZSx6JhQRBG33QNo9+FOh52iXPvpSKCSf5Is677C+GrwwtKkvLWfLK85vDzjBsM269+yEjZlncS6+7fWc53e456+IbCsfx/+x9ZHLVjXenm5YwRizGSiD1uWjeh4Z9xmQUSPmsKpBCS92ZW54qAumq10MLnyocAC6OOeWydKEL/eUJ8ZsxCgKpM8UiYSTaIUe/9hmHuOLacs3aWj9aNFHTJkOTWdFZuRe9yWp176zMVd89f/v7ZNOW6lv36Uzkf35+pOEv4/jTrzCOLeEjkK4fDUUCmT2+oseAaFOGjts3eme8nOhtuISqbYHUc8u/nHKK8b0NPQP7uK56WWLVZewEcvs//p38/Fq72A2zQHLwxSDzHSKQYt5flxh5ZlQVSNZRz5ldcf2dhl0VdKb77POvGvXOiCmQmc+qAiJi20ggpzsuGRehs8n0EpYlnk9cW65qEwmvBJDlM7SgZulzrxi2lehNVrq0SN957umJkWHnyTO942j2Q49ZefjRpcaxJcoE8uXX3k5Xh/O7DJtA6gz7qJMuMcpWQcf9Xx971pjsiUuovARyezMC+cHf1zt/sNj4r147z3zgESNWXcZOIPV58b3tybcsfiaTQOZ9hwqkJr2iCTVEIPP1PPOiaYZNCJr0V737vlF/Ma4CqVWcoX16+oXXG7F849pylVj//Hd/NMrm0f1k2lWmN1kdcNRZhu+Mn+53QrJ5q99lZB94LNkoE0g9S8m/56FA6laDzwIkL3pn2ro6wwk/j0uoSgVywkcTAslnhn3RjxGtVWC8Ooy0QP7r318mm3d8wT+nn6sXfWT4mQwCSb/CNZlee9OsdJEK/56hS5n0J+oIpO7JsLyNb+9xiPOyXYYmzs1bthltUVcg6U+UCQjLq84+Nmwnl41rUvJBz7synk9cCqTeRHL4CRca5fLo+LLVrzK9yUobptN/Rqw9bdl/LlwCqcu9ZccuBdIlHCHox+POxTYWXPHaEkjXXOTDPlNOSTZt3mbEDGWkBXLL518kJ816j39OP//415fJb29Y2eenE0gTrabT5Rj+PY8W0NDnu4ECqRvqP9j7CKN8hhbiaGCl96u270hX/2m138VX3+q8/6TFDGwL3Rd78pkXU7RTEG0ydDknK5ehV1TRnygTEJZXnX1s2E4umzx77X9iKg765X3sqZc5L3Vm/P70qUY8n7gUyHMvnW6UyaNHLbLFVIxTFd1bdPX/FdfPMGxCYP+5cAmkDU3+esXZrw89Pfn+z47oE8hFTy43yhM9gqWx+v7f16WXb7V4qOx5zsP+cGHhwh2XULUlkHn2/M3xyQVX3JTMnvd4unJVWzaWLVgS2l+ZMUMZeYHU93Nf+oxfpZ83P/q8b0PzYRRIDrpQ2D95XAI5oyeQKnP2n24wvsuQaOkxgrzPUIHURMayGZrsFYd1y5Bw6V4D7YQusdlWtmZxy56DpF0RZQLC8k3YCPWpJiBtuZZvX60+Punsq43yeTSpsl8yXHHzAqlNvfl9Hr1KKr+/L+NUpex4u+v+r47jUNj+PvgK5DmX3Jj+MKR9flOO/Y4407DbSe+HwYz7FnxVFhO4boGUXZb9atW3aesSqlQgJ3Jz0ZRA6nVltsdEdElfC85YPo9Ww9MulLEQyB9cuiL5cOM/+HX6ufmpdTv9dAJpkgnkug0bU5Hh9xkH9ya8/GRcNmHZBFL2e/z6OKOsyG9158K1ObUWgrB8FnvcBFLP07F9M7QKct9Dit9BqR8ZRS9qdsXNBFJnO67FJ9qRSZNbvj6MU5XnX3rDiJMnXcVoscujBV26NxjCa2++Y/SRj0DqPiDt2C5adUq7PJf/+c6v62GZxHW7w7Wz0DmXTDdshEuo2hRIHYOuZxz1XdmPAr3+jHYhjIVAiiNuX518qd3L8fni30ky5eZ30jKdQJpkAikkMK6J76YZc3eWDRFI/ZJluQxNQqyTDT0UTdsMDTzGzBgngdSimLLnGhcudl82Tx8FsNi54ipX7Sfr2n1Gl3j1UDfrwzhVWfTEMiNWHuVFG+IjaEXo2GWdyvxpQRRtiPK65i+zDNsMjUdtOrCzHpZJXOixLNpm6F7kxk1bDRuXULUpkOnZssUuz8zZjxh2edK5ymJXlbERSHHnM+tZJP28t+H/ku/9aUUnkBbyAin0a5VlMnb58ZT0l7TKhQik6z6gzohYpyKK7kPosh5jZoyTQOrhadaP6FI17fI88fQLho1wxb34qlvT+0L8e0b2OAfrIhinKrq6wHh5iuqTp0zQXIQIpF5lRhuivFyrc3Vfua8elklcaPcp2uZJH7OBjUuo2hJILaxLtwi02OXRWaTu49I+QxuK0CaEsRLI7178erLqk89ZLP3MWr6hE0gLFMiNm7c6L89pQOjyXIhAnnb+dUa5r/2enhx50sVeFA0M7VbCmBnjJJDaIIDlic4wXVcDii5JuuKWocc5mAf9h1Im+DqjoA0pEzQXVQVSba9JnDZEee2+77GGfcb1t9zfXw/LJC4Ui7Z5tE0bbVxC1ZZAahETy1vpxT7EsauSdpcybAIYK4EU+924KvnnF+a1Vv3luBlr+Oedn04gv6bsbQnXTJ8ZJJBl24TVRfVkzIxxEsgimzyqs+sxg9gCqcuuuhdmyyMGeqcmY+bhIxM2XIJWhs7QWDeXvx/+8mijvI2yHzLae7avHpZJPMO1gtl2ydElVG0JZPq4jsXGoBfb9ZypFj0ZNgGMnUCK6xZ/zKLpR+WLPp1A9uPaqUWLPB4ueZbRJpChk28V8vuU5hm0QGZxq9iExClCsZ0C+XRcgRTaAca2kjjLpy5FVw5E2daIYtETy9OFaEW4tnbT1mesk1Mg9/ETyDXvf2zY5nly6d/662GZxDP0+AjtMy699us9TjNcQtWWQF523R1G+RRLbNeCvR//6rjS9vJhLAVSl1JfXrudxZ2fTiD70S/bKccWL6cuetwiwyaQWt3IcrF5/0P7zj+dQPbThECKu+5bYOSS5VMX16V/LVziIy82mFeGtj7UxhT0m7F+wybDZhACaZzpWybxDFf7jIpA6nlnlk+xxHatl9BGDWXt5cNYCqT4xXVvp/uy+n4GLZAcKHVh/+QJEUihpdKuFYsubAJ5yPHnG+UytAOGFtnUpehtEYMSSMYVZTaM4ROH5YnitiGQ39nzEOtLhhknBNciL6EdmmiTwXyIFp/RX4ZWgbK8iCGQZZdY75mzqL8ulkk8Q3nSPqO5S6zFZ60hAqnV7CyfYol98rnXGPYZ+x95Vn95+vNkbAVS6M0evp9OIO1oA2Da+GATSNcei9oUmuVj0glkP8ECuduBzisLQg9564yM+dRFj3IwVh69/aHoLJLtQ+5zvGdSZ2YsL2IIpHJzLdK57qZ7+utimcSFNh2gbZ6qi3SM1bMFuLaGCxHIwnuHltha0EP7DCN/+vNkrAVSLHl7C82sn04gJ7AcJHqrOu3KsAmktkNjuQyfRRZ1KBPIrBzblbgEZJgEUrgF0v5YhCuu0KSnydj2fsM83PqPcULZ9+Diy4hCokUbwbbJ88n6zwofHRKXXHObYSNiCaTrMY/DT7iovy6W8Sl0KZa2efS2EtpcOPUWo1yGboewDYmu1tAuT4hA6lEyvc1jZ3lL3Cy2a17TzmB9NpY8fBh7gdxj6pvJxu3Fi3Oyz6gLpGAfZbgOJB+B1H29qq+fsQmk3nLPchm6/MryMekEsp8QgUx3ZJkop+fqXHujKrb2C81yYZxQ9PJnxsqjdwMuWPyMYce2yaM9Y+knz4q33zVsRCyBdG0UILTxQl99LGP0D2dMNewytLjJtlGABIxlM7TG4O131hrtmEdzB+3yhAik+PMt931d3hJXTL9jjmGXx9h60JKHD2MvkOKUe9fS1PiMg0AK9pOoK5BiwaNLDVsXNoHU85MuoV2weKlhQ3SZTSvUtJ+o7jNo5aTuRWgjZ+0PyvIZcx5+woiXofYpujRHXAIy7gLJ+unMimXy6Gwv24+VcULRmYPrrR4Zetdofrchto3Qeyz1MmTa5tEPN9plxBJICSDt80hQ2A75sSl716K5oq3mFpdskH78aVcUjgu1Xdn6hFCBVNulr9lTeUtsbdauOYB2O+n9cNPet0XtVYVJIZBi/isbad736QRyAstBktL77owLrzfsi7AJpNCO/CyboYNeZx20ydClF61Oo12G6zLtkmXF29wJbYROGxtVBMTXhn0oQmxI0wKpZxPL3gUpoSo6LkMpm9gztPBLx9u9Dz6aPturSVOXGvV/vSXC9axvRtHLkkUsgRT7uzYr37X4XqSEqmh/4ww9w2mM5x46Q2RZogfu8y8q0C43d967wOtVcqECKXQJ33YGu3rNB85jVKSbDcCOOfgyaQRy18tWJB9v+idd7Px0AjmB5SBJ2fHVvRrXVmN5igRSv3Zdy+k1qWsjghdffSvdHURnnXr1lC6puJaxG3tWAokrbRhX7za86sa701/cr7+52vAhXIOTAlLFhv1YZsPyNpoWSKG+cZ29qF/S+1+WWHXQFQPGio3ewsE2zRNTIBc/9Zzhg+gy6t29PpDYP/bU8+mx+qN9jjHK5dE9zKLXXW3Zut258jXPrr84Kr1q41pxS+oIpJAI6wxfO0fd1EOvaXM9C5thrPwVljx8mDQCKY66413rhub6dAI5geUgSZn4Pj0Tc9x7yigSSFF27yJDg9GVex5NHoxDtLsJ7YrQ83y0F1UFxNeG/Vhmw/I2BiGQiuN6YFvobEDPEdK2DjqT0UutGSsWOqPbuHmL0aZ5Ygqk0Fkt/dRBYqLdjYyxnOO2mfMNO190ifXEs64y/p4RIpA+Z6Yu9Cos62VhSx4+TCqBFHcv20A36acTyAksB0kfvTJ66Jh+iEsgRdm9nyr89vAzCnfQyeNatUfOvGiaYS+qCkhVm6wfy2zY7zYGJZC6z1i2ulQvV6ZtXSS6em6OseqiM6XV731otCeJLZDpa5ymnGL4CqL3I3b+I0vM8Qs2b9meXoo27D2Yduv9ydXTZxp/zwgRSD0K5noczIWO9+xlCgaWPHwYCYEcRzhQYsF+ErEF8rPeL+uygVwmkNoU3TVQfNFOHnpJMP3bUN6uB5vz6H1ztBdVBaSqTdaPZTbsdxuDEkihS+KurdrEo08+Z9jXRWcL026bXenSnwtdVtVjLGxLG7EFUuiH3tEnX2r4q4Ium+r1YMbYLUD3KH3ux+bRphy6B92EQKYLsSpc7RHaoCKts6VNUyx5+NAJZEtwoMSC/SRiC6RIJ0THBFwmkBmz5z1WuhrOhu5j6ozQVxwztKhhr/09trzr/QLXPVfauwRE94dYvszGJjo+Nux3G67+iS2QQgtJaJNH98uKdjqqix470VUJ1/1QF7oMrMdD2IYumhBIIdGX8Lj6rwj9ANRORsa4LeHVFauc9/jz6LloiaNybUIgVUbjVJsG8Hsbamu9UJvt2IclDx86gWwJDpRYsJ9EJYEUlgNlJ7lyusRCfxm+Ain0i/3eOYvS+wf0Q7RYQBPxhx+tN/z4snnr9nTnHpcYaDGSNqimrctmsgvk5q3b0svdtMtz0tlXGz5iorfMXHvTLK/FZLpHp8n62fQhevsm6y6aEsgMPc6glwaUbcqgsz9t1l60WtWLHV9d1dH9ZF1ytf3Q0OultII4f4+vKYEUmzZvS664fkbhJg5qlzvuefir90da2q8PSx4+dALZEhwosWA/BWM5WFJYLjJair+8J67zFy1JB5j2kNS/9fLZdIcNi00oGugS2lffWJU8sfSF9DlMrco0nqFqEfZvVegvNoxHWH6Q6IeXfuTox8CsBx5Jbp81P3l40dL0+NI9Rq3iZL6Dhjnb0HGqRx70TsrZ8x5PRVOPWix6fFn6WNS6DRvNcVoVxNTtCF0l0uYeOrtMY1hyK4T+c/gKZD4vXXl46tkX09d/LXn2pXTFunUxThGWPHzoBLIlOFBiwX4KxnKwpLBcR6Owf6tCf7FhPMLybcP82ob5ecNxWRf6rwv95wgRyNpY8vChE8iW4ECJBfspGMvBksJyHY3C/q0K/cWG8QjLBxP5+GOebcG8vOG4rAv914X+c3QC2VEKB0os2E/BWA6WFJbraBT2b1XoLzaMR1g+mMjHH/NsC+blDcdlXei/LvSfoxPIjlI4UGLBfgrGcrD0wfIdjcD+rQr9xYbxCMtXhscdYXlPmGdbMC9v2A6xYJyq0J+FTiA7SuFAiQX7KRjLwdIHy3c0Bvu4CvQVG8YjLF8ZHneE5T1hnm3BvLxhO8SEsXyhnwI6gewohQMlFuynYCwHSx8s39Eo7Gdf6Cc2jEdYvjI87gjLe8I824J5ecN2iA3jlUF7B51AdpTCgRIL9lMwloOlD5bvaBT2sw/00QSMaYM2leGxF+EYZI5twty8YFs0AWMWQbsSJoVA7nbZCmPS7/BDbcdBEgv2UzCWg6UPlu9oFPZzGbRvCsYtgnaViXzcMb+2YX6lcDyOEJNCIA+cvtKY+Dv8UNtxgMSC/RSM5WDpg+U7God97YK2TcG4RdBuGGCObcLcSuF4HCGuv+X+5NeHnm5l6rQZ/eVZ71AsefgQLJDnzVlrTPwdfqjtOEBiwX4KxnKw9MHyHQOB/V0E7ZqCcYug3bDAPNuCeZXC8TiusN6h0K8nwQL54AvrjIm/w4+5vbbjAIkF+ykIy4FiQJuOgcD+LoJ2TcG4RdBuWGCebcG8vOCYHEdY51Do15Nggfxk43Zj4u/wQ23HARIL9lNlLAeJFdp1DAT2dxG0awrGLYJ2wwLzbAvm5Q3H5bjB+oZCv54EC6ToLrNWp8nLq4J9VBnLQVIIbTsah/1tgzZNwthF0G5YYJ5twty84bgcF1jPOtC3J7UE8rW1mw0B6HCjNuPAiAn7qDKWg8QL+uloBPY3YfmmYfwiaDcsMM+2YX7ecDyOOqxfXejfk1oCKaYu/MAQgQ47aisOiNiwfypjOUi8oJ+OxmCfR+v7AJhDEbQbFphn2zA/bzgeRxnWLQaM4Ym/QNI4990B3SMfpaiNOBiawOi3qrCffaGfjkaJ3u+BMI8iaDcsMM+2YX7ecDyOKqxXLBjHEz+BtBimTHyvy4bdxgHFqG2avrSaYfRdVdjHPtBHR+NE7/dAmEcRtBsWmOcwwBy94bgcRVinWDCOJ+UCaTHqY6LcspUbO5G0oDZR23AQNIXRf1Vh/xZBu46BEr3fA2EeRdBuWGCewwLz9IbjdNRgfWLBOJ64BdJiYGWivM6SusutX6O2GNSZY4bRh1Vh39qgTUcrRO33QHj8FUG7YYF5DhPM1QuO1VGCdYkN43lQLJCWwk5ytt3CncEsyLFh9GNV2K+E5TtaJVq/B8LjrwjaDQvMc9hgvqVwvI4KrEdTMG4J8QRS5Ox15jQZn5NUnQd91pjH6McQ2K8FfdzRPlH7PQAef0XQbhhgjsMIc/aCY3YUYB2agnFLiCuQAn60a4y2VpNwaJPucbpPqbqoTqqb6qi6ZvXmgT4o2P7BsF8L+rdjgpbaJ3q/V4THXxG0axvmN6wwb284bocd5t8UjFuCXSAtBb2hr0kMD/ZBwBxq0fWtPy21UyP9XgEef0XQrm2Y3zDD3L3h+B1WmHeTMHYJpkBaClWC/iY5PNibhvFr0/WrH0XjoOjvkWis3z3h8VcE7dqG+Q07zN8bHn/DBvNtGsYvoRPIAcCDvSkYt2OAcBwUQbuatNn3PP5c0HYYYI7DDvP3hsfgsMA8BwFzKKETyJbgwV8X+u8YMBwHRdCuJm31P4+/Mmg/LDDPYYf5e8PjsG2Y36BgHiX8P3vPiX9WOaP/AAAAAElFTkSuQmCC";

const MAX_RESUME_TEXT_LENGTH = 20000;
const NETLINK_EMAIL = "recruitment@netlink-group.com";

function computeInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  return parts.map((p) => p[0]!.toUpperCase()).join("");
}

type ExtractedResume = {
  fullName: string;
  summary: string;
  experience: { organization: string; title: string; dates: string; bullets: string[] }[];
  skills: string[];
  education: { degree: string; institution: string; dates: string }[];
};

export const convert = action({
  args: { applicationId: v.id("applications") },
  returns: v.object({ netlinkResumeStorageId: v.id("_storage") }),
  handler: async (ctx, args) => {
    const info = await ctx.runQuery(internal.applications.getForConvert, {
      applicationId: args.applicationId,
    });
    if (info === null) {
      throw new ConvexError("Application not found.");
    }

    const blob = await ctx.storage.get(info.resumeStorageId);
    if (blob === null) {
      throw new ConvexError("Resume file is missing.");
    }
    const buffer = Buffer.from(await blob.arrayBuffer());

    let resumeText: string;
    if (info.resumeContentType === "application/pdf") {
      resumeText = await extractPdfText(buffer);
    } else if (
      info.resumeContentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      resumeText = result.value;
    } else {
      throw new ConvexError(
        "This resume format can't be converted — only PDF and Word (.docx) resumes are supported. Legacy .doc files aren't.",
      );
    }

    resumeText = resumeText.trim();
    if (resumeText.length < 40) {
      throw new ConvexError(
        "Couldn't read any text from this resume — it may be a scanned image. Try a text-based PDF or Word doc instead.",
      );
    }
    if (resumeText.length > MAX_RESUME_TEXT_LENGTH) {
      resumeText = resumeText.slice(0, MAX_RESUME_TEXT_LENGTH);
    }

    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new ConvexError("OPENAI_API_KEY is not set on this deployment.");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You extract structured data from a candidate resume's raw text so it can be reformatted into a company template.

Return ONLY a JSON object with keys:
- "fullName": the candidate's full name as written on the resume.
- "summary": a short professional summary paragraph (write one from the resume content if none exists explicitly).
- "experience": an array of objects, most recent first, each with "organization", "title", "dates" (as written, e.g. "Jan 2022 - Present"), and "bullets" (an array of short achievement/responsibility strings, from the resume's own bullet points where present).
- "skills": a flat array of individual skill strings (split out categories/tools into separate entries).
- "education": an array of objects with "degree", "institution", "dates".

If a section is genuinely absent from the resume, return an empty array (or empty string for summary). Do not invent employers, dates, or degrees that aren't in the text.`,
          },
          { role: "user", content: resumeText },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new ConvexError(`AI extraction failed (${res.status}): ${text.slice(0, 300)}`);
    }

    const completion = await res.json();
    const raw = completion.choices?.[0]?.message?.content;
    if (typeof raw !== "string") {
      throw new ConvexError("AI extraction returned no content.");
    }

    let extracted: ExtractedResume;
    try {
      extracted = JSON.parse(raw);
    } catch {
      throw new ConvexError("AI extraction returned invalid JSON.");
    }

    const fullName = extracted.fullName || info.name;
    const initials = computeInitials(fullName);
    const logoBuffer = Buffer.from(NETLINK_LOGO_BASE64, "base64");

    const children: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            type: "png",
            data: logoBuffer,
            transformation: { width: 220, height: 44 },
          }),
        ],
      }),
      new Paragraph({ text: "" }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: initials, bold: true, size: 30 })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Email: ${NETLINK_EMAIL}`, bold: true, size: 30 })],
      }),
      new Paragraph({ text: "" }),
    ];

    if (extracted.summary) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "SUMMARY" }),
        new Paragraph({ alignment: AlignmentType.JUSTIFIED, text: extracted.summary }),
      );
    }

    if (extracted.experience?.length) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: "PROFESSIONAL EXPERIENCE" }));
      for (const job of extracted.experience) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `${job.organization}: ${job.title}   ${job.dates}`,
                bold: true,
              }),
            ],
          }),
        );
        for (const bullet of job.bullets ?? []) {
          children.push(new Paragraph({ text: bullet, bullet: { level: 0 } }));
        }
      }
    }

    if (extracted.skills?.length) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_1, text: "SKILLS" }),
        new Paragraph({ text: extracted.skills.join(", ") }),
      );
    }

    if (extracted.education?.length) {
      children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, text: "EDUCATION" }));
      for (const edu of extracted.education) {
        children.push(
          new Paragraph({ text: `${edu.degree}, ${edu.institution}   ${edu.dates}` }),
        );
      }
    }

    const doc = new Document({ sections: [{ children }] });
    const docBuffer = await Packer.toBuffer(doc);

    const netlinkResumeStorageId = await ctx.storage.store(
      new Blob([Uint8Array.from(docBuffer)], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

    await ctx.runMutation(internal.applications.setNetlinkResume, {
      applicationId: args.applicationId,
      netlinkResumeStorageId,
    });

    return { netlinkResumeStorageId };
  },
});
