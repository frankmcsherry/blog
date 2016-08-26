#!/usr/bin/python
import os, sys, csv
import matplotlib
import numpy as np
import matplotlib.pyplot as plt

def usage():
  print "usage: plot_multithread.py <multithread csv file> [output file]"
  sys.exit(1)

colors = ['y', 'b', 'c', 'r', 'm', 'g']

if len(sys.argv) < 2:
  usage()

if len(sys.argv) == 2:
  outname = "pr-multithreaded.png"
else:
  outname = sys.argv[2]

datafile = sys.argv[1]

labels = []
tw_data = []
uk_data = []
tw_periter_data = []
uk_periter_data = []
first = True
for row in csv.reader(open(datafile).readlines(), delimiter=","):
  if first:
    first = False
    continue
  labels.append(row[1])
  tw_data.append(float(row[2]))
  uk_data.append(float(row[4]))
  tw_periter_data.append(float(row[3]))
  uk_periter_data.append(float(row[5]))

print tw_periter_data

plt.figure(figsize=(6, 4))

width = 1.0

# Twitter
tw_pos = np.arange(len(labels))
plt.bar(tw_pos, tw_data, width, color='g')
plt.axhline(333.72, 0, 0.5, color='b')
plt.text(max(tw_pos) + 1 + width / 4, 343.72, "GraphX, 128 cores", ha='right', fontsize="small", color='b')
plt.axhline(300, 0, 0.5, color='r')
plt.text(max(tw_pos) + 1 + width / 4, 270, "Laptop, 1 core, simple", ha='right', fontsize="small", color='r')
plt.axhline(110, 0, 0.5, color='m')
plt.text(max(tw_pos) + 1 + width / 4, 120, "Laptop,\n 1 core,\n smart", ha='right', fontsize="small", color='m')

# uk
uk_pos = max(tw_pos) + 2 + np.arange(len(labels))
plt.bar(uk_pos, uk_data, width, color='g')
plt.axhline(362, 0.5, 1.0, color='b')
plt.text(max(uk_pos) + 1 + width / 4, 332, "GraphX, 128 cores", ha='right', fontsize="small", color='b')
plt.axhline(651, 0.5, 1.0, color='r')
plt.text(max(uk_pos) + 1 + width / 4, 621, "Laptop, 1 core, simple", ha='right', fontsize="small", color='r')
plt.axhline(256, 0.5, 1.0, color='m')
plt.text(max(uk_pos) + 1 + width / 4, 226, "Laptop, 1 core,\n smart", ha='right', fontsize="small", color='m')

plt.axvline(max(tw_pos) + 1 + width / 2, color='k', lw=1.0)

#plt.ylim(0, 1100)
plt.text(max(tw_pos) / 2 + width / 2, 730, "twitter_rv", ha='center')
plt.text(min(uk_pos) + (len(uk_pos) / 2) + width / 2, 730, "uk_2007_05", ha='center')
plt.xlim(0 - width / 2, max(uk_pos) + 1 + width / 2)
plt.ylabel("End-to-end runtime [sec]")
plt.xlabel("Timely dataflow, total number of cores")
ticks = [x + width / 2 for x in tw_pos]
ticks.extend([x + width / 2 for x in uk_pos])
ticklabels = labels
ticklabels.extend(labels)
plt.xticks(ticks, ticklabels)

#plt.legend(frameon=False, fontsize="small", loc="upper left")

plt.savefig(outname, format="png", bbox_inches="tight")

# -------------------------------

plt.clf()

width = 1.0

# Twitter
#tw_pos = np.arange(len(labels))
plt.bar(tw_pos, tw_periter_data, width, color='g')
plt.axhline(12.2, 0, 0.5, color='b')
plt.text(max(tw_pos) + 1, 11.3, "GraphX, 128 cores", ha='right', fontsize="small", color='b')
#plt.axhline(300, 0, 0.5, color='r')
#plt.text(max(tw_pos) + 1, 270, "Laptop, single thread", ha='right', fontsize="small", color='r')

# uk
#uk_pos = max(tw_pos) + 2 + np.arange(len(labels))
plt.bar(uk_pos, uk_periter_data, width, color='g')
plt.axhline(8.3, 0.5, 1.0, color='b')
plt.text(max(uk_pos) + 1, 7.4, "GraphX, 128 cores", ha='right', fontsize="small", color='b')
#plt.axhline(651, 0.5, 1.0, color='r')
#plt.text(max(uk_pos) + 1, 621, "Laptop, single thread", ha='right', fontsize="small", color='r')

plt.axvline(max(tw_pos) + 1 + width / 2, color='k', lw=1.0)

#plt.ylim(0, 1100)
plt.text(max(tw_pos) / 2 + width / 2, 14.5, "twitter_rv", ha='center')
plt.text(min(uk_pos) + (len(uk_pos) / 2) + width / 2, 14.5, "uk_2007_05", ha='center')
plt.xlim(0 - width / 2, max(uk_pos) + 1 + width / 2)
plt.ylabel("Per-iteration runtime [sec]")
plt.xlabel("Timely dataflow, total number of cores")
ticks = [x + width / 2 for x in tw_pos]
ticks.extend([x + width / 2 for x in uk_pos])
ticklabels = labels
ticklabels.extend(labels)
plt.xticks(ticks, ticklabels)

#plt.legend(frameon=False, fontsize="small", loc="upper left")

plt.savefig("pr-multithreaded-periter.png", format="png", bbox_inches="tight")


