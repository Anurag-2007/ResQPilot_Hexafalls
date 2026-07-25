from torch import nn

class AmbSelModel(nn.Module):
    def __init__(self, _nf :int=41):
        super(AmbSelModel, self).__init__()
        self.model = nn.Sequential(
            nn.Linear(_nf, 64),
            nn.ReLU(),
            nn.Linear(64, 256),
            nn.Dropout(p=0.25),
            nn.ReLU(),
            nn.Linear(256, 64),
            nn.ReLU(),
            nn.Linear(64, 4)
        )

    def forward(self, inp):
        return self.model(inp)