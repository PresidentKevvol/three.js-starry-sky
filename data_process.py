import json

# for reading data in one line of the bright star catalog dataset
def read_one_line(line):
    name = line[4:14]
    # the right ascension of the star
    RA_h = line[75:77]
    RA_m = line[77:79]
    RA_s = line[79:83]
    # the declination of the star
    DE_sign = line[83]
    DE_d = line[84:86]
    DE_m = line[86:88]
    DE_s = line[88:90]
    # the appearent magnitude
    v_mag = line[102:107]
    # the B-V color index
    b_v = line[109:114]
    return {
        "name": name,
        "RA": [RA_h, RA_m, RA_s],
        "DE": [DE_sign, DE_d, DE_m, DE_s],
        "vmag": v_mag,
        "bv": b_v,
    }

def main():
    '''
    # test code
    l = read_one_line("6084 20Sig ScoCD-2511485 147165184336 607I  10009  Sig Sco  161506.5-252110162111.3-253534351.31 17.00 2.89  +0.13 -0.70 +0.11   B1III              -0.010-0.021      +003SBO    53  2.0   0.0 O   4*")
    print(l)
    '''
    # read whole file
    fil = open("bsc5.dat", "r")
    stars = []
    for line in fil:
        if len(line) > 1:
            st = read_one_line(line)
        stars.append(st)
    # convert to json and store in file
    json_text = json.dumps({"stars": stars})
    out = open("bsc.json", "w")
    out.write(json_text)

if __name__ == '__main__':
    main()
