"""Trie DFS, with one dictionary index reused between rounds."""
class TrieSolver:
    def __init__(self, words):
        self.root = {}
        for word in sorted(set(words)):
            node = self.root
            for letter in word.lower():
                node = node.setdefault(letter,{})
            node[''] = word.lower()

    def solve(self, grid):
        rows, cols = grid.shape
        tiles = [str(tile).lower() for tile in grid.flat]
        neighbors = [[nr*cols+nc for nr in range(max(0,r-1),min(rows,r+2))
                      for nc in range(max(0,c-1),min(cols,c+2)) if (nr,nc)!=(r,c)]
                     for r in range(rows) for c in range(cols)]
        found = {}
        def visit(index,node,used,path):
            for letter in tiles[index]:
                node = node.get(letter)
                if node is None:
                    return
            path = path+[(index//cols,index%cols)]
            word = node.get('')
            if word is not None and word not in found:
                found[word] = path
            used |= 1<<index
            for nxt in neighbors[index]:
                if not used & (1<<nxt):
                    visit(nxt,node,used,path)
        for index in range(rows*cols):
            visit(index,self.root,0,[])
        return list(found.items())
