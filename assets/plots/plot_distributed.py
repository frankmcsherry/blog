#!/usr/bin/python
# -*- coding: utf-8 -*-
import os, sys, csv
import matplotlib
import numpy as np
import matplotlib.pyplot as plt

def usage():
  print "usage: plot_distributed.py <twitter csv file> <uk csv file> [output file]"
  sys.exit(1)

colors = ['y', 'b', 'c', 'r', 'm', 'g']

if len(sys.argv) < 3:
  usage()

if len(sys.argv) == 3:
  outname = "pr-distributed.png"
else:
  outname = sys.argv[3]

tw_datafile = sys.argv[1]
uk_datafile = sys.argv[2]

tw_labels = []
uk_labels = []
tw_data = { "1G": [], "1G+": [], "10G": [] }
uk_data = { "1G": [], "1G+": [], "10G": [] }
tw_periter_data = { "1G": [], "1G+": [], "10G": [] }
uk_periter_data = { "1G": [], "1G+": [], "10G": [] }
first = True
for row in csv.reader(open(tw_datafile).readlines(), delimiter=","):
  if first:
    first = False
    continue
  tw_labels.append(row[1][0:-2])
  tw_data["1G"].append(float(row[2]))
  tw_data["1G+"].append(float(row[4]))
  tw_data["10G"].append(float(row[6]))
  tw_periter_data["1G"].append(float(row[3]))
  tw_periter_data["1G+"].append(float(row[5]))
  tw_periter_data["10G"].append(float(row[7]))

first = True
for row in csv.reader(open(uk_datafile).readlines(), delimiter=","):
  if first:
    first = False
    continue
  uk_labels.append(row[1][0:-2])
  uk_data["1G"].append(float(row[2]))
  uk_data["1G+"].append(float(row[4]))
  uk_data["10G"].append(float(row[6]))
  uk_periter_data["1G"].append(float(row[3]))
  uk_periter_data["1G+"].append(float(row[5]))
  uk_periter_data["10G"].append(float(row[7]))

print uk_labels
print uk_data
print uk_periter_data

plt.figure(figsize=(6, 4))

width = 1.0 / 3.0

# Twitter
tw_pos = np.arange(len(tw_labels))
rect_1g = plt.bar(tw_pos, tw_data["1G"], width, color='g')
rect_1gp = plt.bar(tw_pos + width, tw_data["1G+"], width, color='g', hatch="++++")
rect_10g = plt.bar(tw_pos + 2 * width, tw_data["10G"], width, color='g', hatch="////")
rect_1gp[-1].set_facecolor("b")
rect_10g[-1].set_facecolor("b")
rect_1gp[-2].set_facecolor("b")
rect_10g[-2].set_facecolor("b")
#plt.axhline(333, 0, 0.5, color='b')
#plt.text(min(tw_pos), 303, "GraphX, 16 machines", ha='left', fontsize="small", color='b')
plt.axhline(300, 0, 0.5, color='r')
plt.text(min(tw_pos), 270, "Laptop, 1 core, simple", ha='left', fontsize="small", color='r')
plt.axhline(110, 0, 0.5, color='m')
#plt.text(min(tw_pos), 180, "Laptop, 1 core, smart", ha='left', fontsize="small", color='m')
plt.annotate("Laptop, 1 core, smart", xy=(2.75, 110), xytext=(min(tw_pos), 180), fontsize="small", ha="left", color="m", arrowprops=dict(arrowstyle="->", ec='m', fc='m'))

# uk
uk_pos = max(tw_pos) + 2 + np.arange(len(uk_labels))
rect_1g = plt.bar(uk_pos, uk_data["1G"], width, color='g')
rect_1gp = plt.bar(uk_pos + width, uk_data["1G+"], width, color='g', hatch="++++")
rect_10g = plt.bar(uk_pos + 2 * width, uk_data["10G"], width, color='g', hatch="////")
rect_1gp[-1].set_facecolor("b")
rect_10g[-1].set_facecolor("b")
rect_1gp[-2].set_facecolor("b")
rect_10g[-2].set_facecolor("b")
#plt.axhline(362, 0.5, 1.0, color='b')
#plt.text(min(uk_pos), 332, "GraphX, 16 machines", ha='left', fontsize="small", color='b')
plt.axhline(651, 0.5, 1.0, color='r')
plt.text(min(uk_pos), 621, "Laptop, 1 core, simple", ha='left', fontsize="small", color='r')
plt.axhline(256, 0.5, 1.0, color='m')
plt.text(min(uk_pos), 266, "Laptop, 1 core, smart", ha='left', fontsize="small", color='m')

plt.axvline(max(tw_pos) + 1 + 1.5 * width, color='k', lw=1.0)

# fake plots for legend
plt.bar(-1, 0, color='g', label="TD 1G (worker agg.)")
plt.bar(-1, 0, color='g', label="TD 1G+ (process agg.)", hatch="++++")
plt.bar(-1, 0, color='g', label="TD 10G (worker agg.)", hatch="////")
plt.bar(-1, 0, color='b', label="GraphX 1G+", hatch="++++")
plt.bar(-1, 0, color='b', label="GraphX 10G", hatch="////")

#plt.ylim(0, 1100)
#plt.title("Total runtime", gap=20)
plt.text(max(tw_pos) / 2 + width / 2, 730, "twitter_rv", ha='center')
plt.text(min(uk_pos) + (len(uk_pos) / 2) + width / 2, 730, "uk_2007_05", ha='center')
plt.xlim(0 - width, max(uk_pos) + 1 + width)
plt.ylabel("End-to-end runtime [sec]")
plt.xlabel(u"Number of machines (using 8 cores each)")
ticks = [x + 1.5 * width for x in tw_pos]
ticks.extend([x + 1.5 * width for x in uk_pos])
ticklabels = tw_labels
ticklabels.extend(uk_labels)
plt.xticks(ticks, ticklabels)

plt.legend(frameon=False, fontsize="small", loc="upper left")

plt.savefig(outname, format="png", bbox_inches="tight")

# -------------------------------

plt.clf()

width = 1.0 / 3.0

# Twitter
#tw_pos = np.arange(len(labels))
rect_1g = plt.bar(tw_pos, tw_periter_data["1G"], width, color='g')
rect_1gp = plt.bar(tw_pos + width, tw_periter_data["1G+"], width, color='g', hatch="++++")
rect_10g = plt.bar(tw_pos + 2 * width, tw_periter_data["10G"], width, color='g', hatch="////")
rect_1gp[-1].set_facecolor("b")
rect_10g[-1].set_facecolor("b")
rect_1gp[-2].set_facecolor("b")
rect_10g[-2].set_facecolor("b")
#plt.axhline(12.2, 0, 0.5, color='b')
#plt.text(min(tw_pos), 11.3, "GraphX, 16 machines", ha='left', fontsize="small", color='b')
#plt.axhline(300, 0, 0.5, color='r')
#plt.text(max(tw_pos) + 1, 270, "Laptop, single thread", ha='right', fontsize="small", color='r')

# uk
#uk_pos = max(tw_pos) + 2 + np.arange(len(labels))
rect_1g = plt.bar(uk_pos, uk_periter_data["1G"], width, color='g')
rect_1gp = plt.bar(uk_pos + width, uk_periter_data["1G+"], width, color='g', hatch="++++")
rect_10g = plt.bar(uk_pos + 2 * width, uk_periter_data["10G"], width, color='g', hatch="////")
rect_1gp[-1].set_facecolor("b")
rect_10g[-1].set_facecolor("b")
rect_1gp[-2].set_facecolor("b")
rect_10g[-2].set_facecolor("b")
#plt.axhline(8.3, 0.5, 1.0, color='b')
#plt.text(min(uk_pos) + 1, 7.4, "GraphX, 16 machines", ha='left', fontsize="small", color='b')
#plt.axhline(651, 0.5, 1.0, color='r')
#plt.text(max(uk_pos) + 1, 621, "Laptop, single thread", ha='right', fontsize="small", color='r')

plt.axvline(max(tw_pos) + 1 + 1.5 * width, color='k', lw=1.0)

# fake plots for legend
plt.bar(-1, 0, color='g', label="TD 1G (worker agg.)")
plt.bar(-1, 0, color='g', label="TD 1G+ (process agg.)", hatch="++++")
plt.bar(-1, 0, color='g', label="TD 10G (worker agg.)", hatch="////")
plt.bar(-1, 0, color='b', label="GraphX 1G+", hatch="++++")
plt.bar(-1, 0, color='b', label="GraphX 10G", hatch="////")

#plt.ylim(0, 1100)
#plt.title("Per-iteration runtime")
plt.text(max(tw_pos) / 2 + width / 2, 16.8, "twitter_rv", ha='center')
plt.text(min(uk_pos) + (len(uk_pos) / 2) + width / 2, 16.8, "uk_2007_05", ha='center')
plt.xlim(0 - width, max(uk_pos) + 1 + width)
plt.ylabel("Per-iteration runtime [sec]")
plt.xlabel(u"Number of machines (using 8 cores each)")
ticks = [x + 1.5 * width for x in tw_pos]
ticks.extend([x + 1.5 * width for x in uk_pos])
ticklabels = tw_labels
ticklabels.extend(uk_labels)
plt.xticks(ticks, ticklabels)

plt.legend(frameon=False, fontsize="small", loc="upper left")

plt.savefig("pr-distributed-periter.png", format="png", bbox_inches="tight")


