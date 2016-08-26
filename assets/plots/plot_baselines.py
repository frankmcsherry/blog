#!/usr/bin/python
import os, sys, csv
import matplotlib
import numpy as np
import matplotlib.pyplot as plt

def usage():
  print "usage: plot_baselines.py <csv file> [output file]"
  sys.exit(1)

def add_annot(ax, x, y, s, widthB):
  return ax.annotate(s, (x, y), (x+0.065, y+0.06),
                     xycoords="figure fraction", textcoords="figure fraction",
                     ha="right", va="center",
                     size=10, rotation=0, color='r',
                     annotation_clip=False,
                     arrowprops=dict(arrowstyle='-[,widthB=%f' % (widthB),
                                     fc="w", ec="r", lw=1.0,
                                     connectionstyle="arc3",
                                     ),
                     bbox=dict(boxstyle="square", fc="w", ec=None, lw=0))


colors = ['y', 'c', 'b', 'r', 'm', 'g']

if len(sys.argv) < 2:
  usage()

if len(sys.argv) == 2:
  outname = "pr-baselines.png"
else:
  outname = sys.argv[2]

datafile = sys.argv[1]

labels = []
data = []
first = True
for row in csv.reader(open(datafile).readlines(), delimiter=","):
  if first:
    first = False
    continue
  labels.append(row[0])
  data.append([float(row[2]), float(row[3])])

plt.figure(figsize=(6, 4))

pos = np.arange(2)
width = 0.8 / len(labels)

i = 0
for d in data:
  plt.bar(pos + i * width, d, width, label=labels[i], color=colors[i])
  i += 1

ann1 = add_annot(plt.axes(), 0.275, 0.55, "128 cores", 3.5)
ann2 = add_annot(plt.axes(), 0.475, 0.3, "1 core", 2.5)

#plt.ylim(0, 1100)
plt.xlim(0 - width / 2, max(pos) + width * len(labels) + width / 2)
plt.ylabel("Runtime [sec]")
plt.xlabel("Graph")
plt.xticks(pos + (width*len(labels) / 2), ["twitter_rv", "uk_2007_05"])

plt.legend(frameon=False, fontsize="small", loc="upper left")

plt.savefig(outname, format="png", bbox_inches="tight")
